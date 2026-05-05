import re

with open('backend/public/cac-landing.html', 'r', encoding='utf-8') as f:
    content = f.read()

old = '<div class="section-eyebrow">Leadership</div>\n      <p class="pastor-name">Pastor (Prof.) Anthony Adegbulugbe</p>\n      <p class="pastor-title-tag">Presiding Pastor · Christ Apostolic Church</p>'
new = '<div class="section-eyebrow">Leadership</div>\n      <h2 class="section-title" style="color:var(--white);margin-bottom:4px;">Our Shepherd</h2>\n      <p class="pastor-title-tag">Presiding Pastor · Christ Apostolic Church</p>\n      <p class="pastor-name" style="margin-top:16px;">Pastor (Prof) Anthony Adegbulugbe</p>'

if old in content:
    content = content.replace(old, new)
    with open('backend/public/cac-landing.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Updated successfully')
else:
    print('Pattern not found')
