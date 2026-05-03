import { useEffect, useState } from 'react';
import useAuthStore from '../context/authStore';
import { facilitiesAPI, branchesAPI } from '../services/api';
import { PageHeader, Card, Badge, Button, Modal, Input, Select, Spinner, Table } from '../components/UI';

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );
}

const canManageFacilities = (role) => ['super_admin', 'branch_admin'].includes(role || '');

export default function FacilitiesPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = canManageFacilities(user?.role);

  const [tab, setTab] = useState('facilities');

  const [facRows, setFacRows] = useState([]);
  const [facPagination, setFacPagination] = useState({});
  const [facPage, setFacPage] = useState(1);
  const [facSearch, setFacSearch] = useState('');
  const [facLoading, setFacLoading] = useState(true);

  const [bookRows, setBookRows] = useState([]);
  const [bookPagination, setBookPagination] = useState({});
  const [bookPage, setBookPage] = useState(1);
  const [bookLoading, setBookLoading] = useState(false);

  const [branches, setBranches] = useState([]);
  const [facPicklist, setFacPicklist] = useState([]);
  const [facModal, setFacModal] = useState(false);
  const [facForm, setFacForm] = useState({});
  const [bookModal, setBookModal] = useState(false);
  const [bookForm, setBookForm] = useState({});
  const [editBooking, setEditBooking] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    branchesAPI
      .getAll({ limit: 300 })
      .then((r) => setBranches(r.data?.data ?? []))
      .catch(() => setBranches([]));
  }, []);

  const loadFacilities = async () => {
    setFacLoading(true);
    try {
      const res = await facilitiesAPI.getAll({
        page: facPage,
        limit: 15,
        search: facSearch.trim() || undefined,
      });
      setFacRows(res.data?.data ?? []);
      setFacPagination(res.data?.pagination ?? {});
    } catch (e) {
      console.error(e);
    } finally {
      setFacLoading(false);
    }
  };

  useEffect(() => {
    loadFacilities();
  }, [facPage]);

  useEffect(() => {
    const t = setTimeout(() => {
      setFacPage(1);
      loadFacilities();
    }, 350);
    return () => clearTimeout(t);
  }, [facSearch]);

  const loadBookings = async () => {
    setBookLoading(true);
    try {
      const res = await facilitiesAPI.getBookings({ page: bookPage, limit: 20 });
      setBookRows(res.data?.data ?? []);
      setBookPagination(res.data?.pagination ?? {});
    } catch (e) {
      console.error(e);
    } finally {
      setBookLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'bookings') loadBookings();
  }, [tab, bookPage]);

  const openFacilityModal = () => {
    setFacForm({
      branch_id: user?.branch_id || '',
      name: '',
      facility_type: '',
      capacity: '',
      description: '',
    });
    setFacModal(true);
  };

  const saveFacility = async () => {
    if (!facForm.name?.trim()) {
      alert('Name is required.');
      return;
    }
    if (!facForm.branch_id) {
      alert('Select a branch.');
      return;
    }
    setSaving(true);
    try {
      await facilitiesAPI.create({
        branch_id: facForm.branch_id,
        name: facForm.name.trim(),
        facility_type: facForm.facility_type || undefined,
        capacity: facForm.capacity === '' ? undefined : parseInt(facForm.capacity, 10),
        description: facForm.description || undefined,
      });
      setFacModal(false);
      loadFacilities();
    } catch (e) {
      alert(e.response?.data?.message || 'Could not create facility.');
    } finally {
      setSaving(false);
    }
  };

  const openBookingModal = async () => {
    let list = facRows;
    try {
      const res = await facilitiesAPI.getAll({ page: 1, limit: 200 });
      list = res.data?.data ?? [];
      setFacPicklist(list);
    } catch {
      setFacPicklist(facRows);
    }
    setBookForm({
      facility_id: list[0]?.id || '',
      booking_date: new Date().toISOString().slice(0, 10),
      start_time: '09:00',
      end_time: '10:00',
      event_name: '',
      purpose: '',
      attendee_count: '',
      status: 'pending',
    });
    setBookModal(true);
  };

  const saveBooking = async () => {
    if (!bookForm.facility_id || !bookForm.booking_date || !bookForm.start_time || !bookForm.end_time) {
      alert('Facility, date, start and end times are required.');
      return;
    }
    setSaving(true);
    try {
      await facilitiesAPI.createBooking({
        facility_id: bookForm.facility_id,
        booking_date: bookForm.booking_date,
        start_time: bookForm.start_time,
        end_time: bookForm.end_time,
        event_name: bookForm.event_name || undefined,
        purpose: bookForm.purpose || undefined,
        attendee_count: bookForm.attendee_count === '' ? undefined : parseInt(bookForm.attendee_count, 10),
        status: bookForm.status,
      });
      setBookModal(false);
      loadBookings();
    } catch (e) {
      alert(e.response?.data?.message || 'Could not create booking.');
    } finally {
      setSaving(false);
    }
  };

  const deleteBooking = async (b) => {
    if (!confirm('Permanently delete this booking?')) return;
    try {
      await facilitiesAPI.deleteBooking(b.id);
      if (editBooking?.id === b.id) setEditBooking(null);
      loadBookings();
    } catch (e) {
      alert(e.response?.data?.message || 'Could not delete booking.');
    }
  };

  const saveBookingEdit = async () => {
    if (!editBooking) return;
    setSaving(true);
    try {
      await facilitiesAPI.updateBooking(editBooking.id, {
        status: editBooking.status,
        event_name: editBooking.event_name || undefined,
        booking_date: editBooking.booking_date,
        start_time: editBooking.start_time,
        end_time: editBooking.end_time,
      });
      setEditBooking(null);
      loadBookings();
    } catch (e) {
      alert(e.response?.data?.message || 'Could not update booking.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Facilities"
        subtitle="Rooms, halls, and reservations"
        action={
          canManage ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setTab('bookings')}>
                View bookings
              </Button>
              <Button onClick={openFacilityModal}>+ Facility</Button>
            </div>
          ) : null
        }
      />

      <div className="flex gap-2 mb-4">
        <TabButton active={tab === 'facilities'} onClick={() => setTab('facilities')}>
          Facilities
        </TabButton>
        <TabButton active={tab === 'bookings'} onClick={() => setTab('bookings')}>
          Bookings
        </TabButton>
      </div>

      {tab === 'facilities' && (
        <Card>
          <div className="p-5 border-b border-gray-100 flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Search facilities…"
              value={facSearch}
              onChange={(e) => {
                setFacSearch(e.target.value);
                setFacPage(1);
              }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64"
            />
            <span className="ml-auto text-xs text-gray-400">{facPagination.total ?? 0} facilities</span>
          </div>
          {facLoading ? (
            <Spinner />
          ) : (
            <Table headers={['Name', 'Branch', 'Type', 'Capacity', 'Active']}>
              {facRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-400">
                    No facilities
                  </td>
                </tr>
              ) : (
                facRows.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{f.name}</td>
                    <td className="px-4 py-3 text-gray-600">{f.branch_name}</td>
                    <td className="px-4 py-3 text-gray-600">{f.facility_type || '—'}</td>
                    <td className="px-4 py-3">{f.capacity ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={f.is_active ? 'success' : 'default'}>{f.is_active ? 'yes' : 'no'}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </Table>
          )}
          {facPagination.pages > 1 && (
            <div className="flex justify-between px-5 py-4 border-t">
              <Button variant="outline" size="sm" onClick={() => setFacPage((p) => Math.max(1, p - 1))} disabled={facPage === 1}>
                ← Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFacPage((p) => p + 1)}
                disabled={facPage >= facPagination.pages}
              >
                Next →
              </Button>
            </div>
          )}
        </Card>
      )}

      {tab === 'bookings' && (
        <Card>
          <div className="p-5 border-b flex justify-between items-center">
            <span className="text-sm text-gray-600">{bookPagination.total ?? 0} bookings</span>
            {canManage ? <Button onClick={openBookingModal}>+ New booking</Button> : null}
          </div>
          {bookLoading ? (
            <Spinner />
          ) : (
            <Table headers={['Facility', 'Date', 'Time', 'Event', 'Status', 'Actions']}>
              {bookRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400">
                    No bookings
                  </td>
                </tr>
              ) : (
                bookRows.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{b.facility_name}</td>
                    <td className="px-4 py-3 text-xs">{b.booking_date}</td>
                    <td className="px-4 py-3 text-xs">
                      {b.start_time}–{b.end_time}
                    </td>
                    <td className="px-4 py-3">{b.event_name || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={b.status === 'confirmed' ? 'success' : b.status === 'cancelled' ? 'danger' : 'warning'}>
                        {b.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {canManage ? (
                        <div className="flex gap-2 flex-wrap">
                          <Button variant="outline" size="sm" onClick={() => setEditBooking({ ...b })}>
                            Edit
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => deleteBooking(b)}>
                            Delete
                          </Button>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </Table>
          )}
          {bookPagination.pages > 1 && (
            <div className="flex justify-between px-5 py-4 border-t">
              <Button variant="outline" size="sm" onClick={() => setBookPage((p) => Math.max(1, p - 1))} disabled={bookPage === 1}>
                ← Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBookPage((p) => p + 1)}
                disabled={bookPage >= bookPagination.pages}
              >
                Next →
              </Button>
            </div>
          )}
        </Card>
      )}

      <Modal
        open={facModal}
        onClose={() => !saving && setFacModal(false)}
        title="New facility"
        footer={
          <>
            <Button variant="outline" onClick={() => setFacModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveFacility} disabled={saving}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="Branch" value={facForm.branch_id || ''} onChange={(e) => setFacForm((f) => ({ ...f, branch_id: e.target.value }))}>
            <option value="">Select branch…</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Input label="Name" value={facForm.name || ''} onChange={(e) => setFacForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Type (optional)" value={facForm.facility_type || ''} onChange={(e) => setFacForm((f) => ({ ...f, facility_type: e.target.value }))} />
          <Input
            label="Capacity"
            type="number"
            value={facForm.capacity ?? ''}
            onChange={(e) => setFacForm((f) => ({ ...f, capacity: e.target.value }))}
          />
          <Input label="Description" value={facForm.description || ''} onChange={(e) => setFacForm((f) => ({ ...f, description: e.target.value }))} />
        </div>
      </Modal>

      <Modal
        open={bookModal}
        onClose={() => !saving && setBookModal(false)}
        title="New booking"
        footer={
          <>
            <Button variant="outline" onClick={() => setBookModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveBooking} disabled={saving}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Facility"
            value={bookForm.facility_id || ''}
            onChange={(e) => setBookForm((f) => ({ ...f, facility_id: e.target.value }))}
          >
            <option value="">Select…</option>
            {(facPicklist.length ? facPicklist : facRows).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.branch_name})
              </option>
            ))}
          </Select>
          <Input type="date" label="Date" value={bookForm.booking_date || ''} onChange={(e) => setBookForm((f) => ({ ...f, booking_date: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start" type="time" value={bookForm.start_time || ''} onChange={(e) => setBookForm((f) => ({ ...f, start_time: e.target.value }))} />
            <Input label="End" type="time" value={bookForm.end_time || ''} onChange={(e) => setBookForm((f) => ({ ...f, end_time: e.target.value }))} />
          </div>
          <Input label="Event name" value={bookForm.event_name || ''} onChange={(e) => setBookForm((f) => ({ ...f, event_name: e.target.value }))} />
          <Input label="Purpose" value={bookForm.purpose || ''} onChange={(e) => setBookForm((f) => ({ ...f, purpose: e.target.value }))} />
          <Select label="Status" value={bookForm.status || 'pending'} onChange={(e) => setBookForm((f) => ({ ...f, status: e.target.value }))}>
            <option value="pending">pending</option>
            <option value="confirmed">confirmed</option>
            <option value="cancelled">cancelled</option>
          </Select>
        </div>
      </Modal>

      <Modal
        open={!!editBooking}
        onClose={() => !saving && setEditBooking(null)}
        title="Edit booking"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <Button variant="danger" onClick={() => editBooking && deleteBooking(editBooking)} disabled={saving}>
              Delete
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setEditBooking(null)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={saveBookingEdit} disabled={saving}>
                Save
              </Button>
            </div>
          </div>
        }
      >
        {editBooking && (
          <div className="space-y-4">
            <Select label="Status" value={editBooking.status} onChange={(e) => setEditBooking((b) => ({ ...b, status: e.target.value }))}>
              <option value="pending">pending</option>
              <option value="confirmed">confirmed</option>
              <option value="cancelled">cancelled</option>
            </Select>
            <Input label="Event name" value={editBooking.event_name || ''} onChange={(e) => setEditBooking((b) => ({ ...b, event_name: e.target.value }))} />
            <Input type="date" label="Date" value={editBooking.booking_date?.slice?.(0, 10) || editBooking.booking_date} onChange={(e) => setEditBooking((b) => ({ ...b, booking_date: e.target.value }))} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Start" type="time" value={(editBooking.start_time || '').slice(0, 5)} onChange={(e) => setEditBooking((b) => ({ ...b, start_time: e.target.value }))} />
              <Input label="End" type="time" value={(editBooking.end_time || '').slice(0, 5)} onChange={(e) => setEditBooking((b) => ({ ...b, end_time: e.target.value }))} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
