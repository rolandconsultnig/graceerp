require('./loadEnv');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { createPool } = require('./createPool');

const pool = createPool();

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding GraceERP database...');
    await client.query('BEGIN');

    // ── Church ────────────────────────────────────────────────────────────────
    const churchId = uuidv4();
    await client.query(
      `INSERT INTO churches (id, name, tagline, address, city, state, country, email, phone, currency)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [churchId, 'Christ Apostolic Church (All Saints) DCC', 'Located in Citec Estate, Abuja',
       'Citec Estate', 'Abuja', 'FCT', 'Nigeria',
       'info@clci.org', '+234 803 000 0001', 'NGN']
    );

    // ── Branches ──────────────────────────────────────────────────────────────
    const hqId   = uuidv4();
    const lagId  = uuidv4();
    const phId   = uuidv4();
    const enId   = uuidv4();

    await client.query(
      `INSERT INTO branches (id,church_id,name,code,address,city,state,service_schedule,capacity,is_headquarters,status)
       VALUES
       ($1,$5,'Main sanctuary · Citec Estate','CAC-CITEC','Citec Estate','Abuja','FCT','Sundays 8AM & 10:30AM, Wednesdays 5:30PM',2000,true,'active'),
       ($2,$5,'Lagos Branch','LAG-IKJ','22 Broad Street','Lagos','Lagos','Sundays 9AM & 11:30AM',1500,false,'active'),
       ($3,$5,'Port Harcourt Branch','PH-GRA','5 Aba Road','Port Harcourt','Rivers','Sundays 8:30AM & 10AM',800,false,'active'),
       ($4,$5,'Enugu Branch','ENU-INP','8 Independence Layout','Enugu','Enugu','Sundays 9AM',500,false,'active')`,
      [hqId, lagId, phId, enId, churchId]
    );

    // ── Users / Admin accounts ────────────────────────────────────────────────
    const passHash = await bcrypt.hash('GraceERP@2025', 10);

    const superAdminId = uuidv4();
    const financeUserId = uuidv4();
    const branchAdminId = uuidv4();
    const pastorUserId  = uuidv4();

    await client.query(
      `INSERT INTO users (id,church_id,branch_id,email,password_hash,full_name,role)
       VALUES
       ($1,$5,$6,'admin@clci.org',$8,'Bishop Emmanuel Adewale','super_admin'),
       ($2,$5,$6,'finance@clci.org',$8,'Biodun Salami','finance_officer'),
       ($3,$5,$7,'lagos.admin@clci.org',$8,'Rev. Michael Okonkwo','branch_admin'),
       ($4,$5,$6,'pastor@clci.org',$8,'Pastor Ruth Nwosu','pastor')`,
      [superAdminId, financeUserId, branchAdminId, pastorUserId,
       churchId, hqId, lagId, passHash]
    );
    console.log('  ✓ Users created — default password: GraceERP@2025');

    // ── Sample Members ────────────────────────────────────────────────────────
    const memberData = [
      ['Adaeze','Okonkwo','adaeze@email.com','+2348031000001','female','cell_leader','Choir',hqId],
      ['Emeka','Chukwu','emeka@email.com','+2348031000002','male','deacon','Ushering',lagId],
      ['Fatima','Aliyu','fatima@email.com','+2348031000003','female','general_member','Media',hqId],
      ['Taiwo','Adebayo','taiwo@email.com','+2348031000004','male','minister','Finance',phId],
      ['Ngozi','Eze','ngozi@email.com','+2348031000005','female','general_member','Children',enId],
      ['Samuel','Bello','samuel@email.com','+2348031000006','male','deacon','Protocol',hqId],
      ['Grace','Okafor','grace@email.com','+2348031000007','female','cell_leader','Prayer',lagId],
      ['David','Musa','david@email.com','+2348031000008','male','general_member','IT',hqId],
    ];

    let fatimaMemberId = null;
    for (const [fn, ln, em, ph, gn, tier, dept, brId] of memberData) {
      const code = `MBR-${Math.floor(Math.random()*9000+1000)}`;
      const ins = await client.query(
        `INSERT INTO members (id,church_id,branch_id,member_code,first_name,last_name,
                              email,phone,gender,tier,department,status)
         VALUES (uuid_generate_v4(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active')
         RETURNING id, email`,
        [churchId, brId, code, fn, ln, em, ph, gn, tier, dept]
      );
      if (String(em).toLowerCase() === 'fatima@email.com') {
        fatimaMemberId = ins.rows[0].id;
      }
    }
    console.log('  ✓ Sample members created');

    const memberPortalUserId = uuidv4();
    await client.query(
      `INSERT INTO users (id, church_id, branch_id, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, 'member@clci.org', $4, 'Fatima Aliyu', 'member')`,
      [memberPortalUserId, churchId, hqId, passHash]
    );
    if (fatimaMemberId) {
      await client.query(`UPDATE members SET user_id = $1 WHERE id = $2`, [memberPortalUserId, fatimaMemberId]);
      console.log('  ✓ Member portal demo login linked (Fatima Aliyu → member@clci.org)');
    } else {
      console.warn(
        '  ⚠ Could not link member@clci.org — no Fatima sample member row (fatima@email.com). Member portal will 403 until linked.'
      );
    }

    // ── Sample Giving Records ─────────────────────────────────────────────────
    const givingTypes = ['tithe','offering','special_seed','project_fund'];
    const methods = ['cash','bank_transfer','pos','online_paystack'];
    for (let i = 0; i < 20; i++) {
      const rcpt = `RCP-${String(i+1).padStart(4,'0')}`;
      const amount = (Math.floor(Math.random() * 100) + 5) * 1000;
      const branchIds = [hqId, lagId, phId, enId];
      const brId = branchIds[Math.floor(Math.random() * branchIds.length)];
      await client.query(
        `INSERT INTO giving_records (id,church_id,branch_id,giving_type,amount,payment_method,
                                    receipt_number,giving_date,recorded_by)
         VALUES (uuid_generate_v4(),$1,$2,$3,$4,$5,$6,CURRENT_DATE - $7 * INTERVAL '1 day',$8)`,
        [churchId, brId, givingTypes[i%4], amount, methods[i%4],
         rcpt, i, financeUserId]
      );
    }
    console.log('  ✓ Sample giving records created');

    // ── Sample Assets ─────────────────────────────────────────────────────────
    const assetData = [
      ['AST-001','Toyota HiAce Bus','vehicle','TYT-HC-2019',18500000,hqId],
      ['AST-002','Yamaha Grand Piano','instrument','YMH-GP-2020',4200000,hqId],
      ['AST-003','Projector System','equipment','PRJ-EPS-2021',2800000,lagId],
      ['AST-004','Generator 100KVA','equipment','GEN-100KVA-2018',7500000,phId],
      ['AST-005','MacBook Pro (x5)','it','APL-MBP-2023',6250000,hqId],
    ];
    for (const [tag, name, cat, serial, cost, brId] of assetData) {
      await client.query(
        `INSERT INTO assets (id,church_id,branch_id,asset_tag,name,category,
                             serial_number,purchase_cost,current_value,status)
         VALUES (uuid_generate_v4(),$1,$2,$3,$4,$5,$6,$7,$7*0.85,'active')`,
        [churchId, brId, tag, name, cat, serial, cost]
      );
    }
    console.log('  ✓ Sample assets created');

    // ── Sample Sermons ────────────────────────────────────────────────────────
    const sermonData = [
      ['Walking in Divine Purpose','Bishop Emmanuel Adewale','Kingdom Living','Romans 8:28',58],
      ['The Power of Covenant','Pastor Ruth Nwosu','Covenant Series','Hebrews 8:6',45],
      ['Unshakeable Faith','Bishop Emmanuel Adewale','Faith Foundations','Hebrews 11:1',62],
      ['Restoration Season','Pastor Mike Obi','Special Series','Joel 2:25',50],
      ['Grace for Every Season','Evang. Chioma Eze','Grace Series','2 Cor 12:9',41],
    ];
    for (const [title, preacher, series, scripture, duration] of sermonData) {
      await client.query(
        `INSERT INTO sermons (id,church_id,branch_id,title,preacher_name,series,
                              scripture_ref,sermon_date,duration_minutes,play_count,uploaded_by)
         VALUES (uuid_generate_v4(),$1,$2,$3,$4,$5,$6,
                 CURRENT_DATE - (random()*30)::INT * INTERVAL '1 day',$7,
                 (random()*1500)::INT,$8)`,
        [churchId, hqId, title, preacher, series, scripture, duration, superAdminId]
      );
    }
    console.log('  ✓ Sample sermons created');

    // ── Sample Budget ─────────────────────────────────────────────────────────
    const depts = ['Administration','Media & Communications','Facilities','Welfare & Outreach','IT'];
    const amounts = [24000000, 18000000, 32000000, 20000000, 12000000];
    for (let i = 0; i < depts.length; i++) {
      await client.query(
        `INSERT INTO budgets (id,church_id,branch_id,fiscal_year,department,
                              total_amount,status,approved_by)
         VALUES (uuid_generate_v4(),$1,$2,2025,$3,$4,'active',$5)`,
        [churchId, hqId, depts[i], amounts[i], superAdminId]
      );
    }
    console.log('  ✓ Sample budgets created');

    // ── Sample Events ─────────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO events (id,church_id,branch_id,title,event_type,venue,
                           event_date,start_time,capacity,rsvp_count,status,created_by)
       VALUES
       (uuid_generate_v4(),$1,$2,'Sunday Service','service','Main Auditorium',
        CURRENT_DATE + 7,'08:00',1200,843,'upcoming',$3),
       (uuid_generate_v4(),$1,$2,'Youth Conference 2025','conference','Convention Center',
        CURRENT_DATE + 19,'09:00',2000,1456,'upcoming',$3),
       (uuid_generate_v4(),$1,$2,'Leadership Retreat','retreat','Ibadan Venue',
        CURRENT_DATE + 26,'08:00',80,65,'upcoming',$3)`,
      [churchId, hqId, superAdminId]
    );
    console.log('  ✓ Sample events created');

    // ── Sample Staff ──────────────────────────────────────────────────────────
    const staffData = [
      ['Rev. Chidi Obi','Senior Pastor','Executive','full_time',350000],
      ['Mrs Tunde Akinyele','Admin Officer','Administration','full_time',120000],
      ['Engr. Kelechi Nwankwo','IT Manager','ICT','full_time',180000],
      ['Miss Yetunde Afolabi','Media Director','Media','full_time',150000],
      ['Mr Biodun Salami','Accountant','Finance','full_time',160000],
    ];
    for (let i = 0; i < staffData.length; i++) {
      const [name, role, dept, type, salary] = staffData[i];
      await client.query(
        `INSERT INTO staff (id,church_id,branch_id,employee_number,full_name,
                            role_title,department,employment_type,monthly_salary,
                            start_date,is_active)
         VALUES (uuid_generate_v4(),$1,$2,$3,$4,$5,$6,$7,$8,'2020-01-01',true)`,
        [churchId, hqId, `EMP-${String(i+1).padStart(3,'0')}`,
         name, role, dept, type, salary]
      );
    }
    console.log('  ✓ Sample staff created');

    await client.query('COMMIT');
    console.log('\n🎉 Database seeded successfully!');
    console.log('\n📋 Login credentials:');
    console.log('   Super Admin: admin@clci.org / GraceERP@2025');
    console.log('   Finance:     finance@clci.org / GraceERP@2025');
    console.log('   Branch Admin: lagos.admin@clci.org / GraceERP@2025');
    console.log('   Pastor:      pastor@clci.org / GraceERP@2025');
    console.log('   Member portal: member@clci.org / GraceERP@2025\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
