import urllib.request
import urllib.error
import json
import sys

base = 'http://localhost:8080'

def req(path, method='GET', data=None, headers=None):
    h = headers or {}
    b = json.dumps(data).encode('utf-8') if data else None
    if data and 'Content-Type' not in h:
        h['Content-Type'] = 'application/json'
    r = urllib.request.Request(base + path, data=b, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=5) as res:
            ct = res.headers.get('Content-Type', '')
            content = res.read().decode('utf-8')
            return res.status, json.loads(content) if 'application/json' in ct else content
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8')

print('--- Testing Extended Routes ---')
# 1. Embed
s, c = req('/embed/gallery')
assert s == 200 and 'LIVE GALLERY EMBED' in c, f"Embed failed: {s}"
print('1. /embed/gallery: PASS')

# 2. Add Comment
s, c = req('/api/projects/prj_01/comments', 'POST', {'content': 'Phenomenal architecture test', 'author_name': 'Test Runner', 'author_role': 'judge'})
assert s == 201 and c.get('id'), f"POST comment failed: {s}"
print('2. POST /api/projects/prj_01/comments: PASS')

# 3. Get Comments
s, c = req('/api/projects/prj_01/comments')
assert s == 200 and len(c) > 0, f"GET comments failed: {s}"
print('3. GET /api/projects/prj_01/comments: PASS')

# 4. Quadratic Vote
s, c = req('/api/projects/prj_01/quadratic-vote', 'POST', {'credits': 16})
assert s == 200 and c.get('voice_influence') == 4, f"Quadratic vote failed: {s}"
print('4. POST /api/projects/prj_01/quadratic-vote: PASS')

# 5. Team Invite
s, c = req('/api/teams/invite', 'POST', {'team_id': 'tm_01', 'team_name': 'Quantum Coders'}, {'Cookie': 'session=prt_2e88'})
assert s == 201 and len(c.get('invite_code', '')) == 8, f"Team invite failed: {s}"
code = c['invite_code']
print(f'5. POST /api/teams/invite ({code}): PASS')

# 6. Team Invite Lookup
s, c = req(f'/api/teams/invite/{code}')
assert s == 200 and c.get('team_name') == 'Quantum Coders', f"Invite lookup failed: {s}"
print('6. GET /api/teams/invite/<code>: PASS')

# 7. Team Join
s, c = req('/api/teams/join', 'POST', {'invite_code': code, 'email': 'coder42@example.com'})
assert s == 200 and 'coder42@example.com' in c.get('members', []), f"Team join failed: {s}"
print('7. POST /api/teams/join: PASS')

# 8. Organizer Auto-Assign
s, c = req('/api/organizer/auto-assign', 'POST', {'reviews_per_project': 3}, {'Cookie': 'session=org_7f2a'})
assert s == 200 and c.get('assignments_created') > 0, f"Auto assign failed: {s}"
print('8. POST /api/organizer/auto-assign: PASS')

# 9. Judge Assignments
s, c = req('/api/judge/assignments', headers={'Cookie': 'session=jdg_a_91bc'})
assert s == 200 and len(c) > 0, f"Judge assignments failed: {s}"
print('9. GET /api/judge/assignments: PASS')

# 10. Organizer Visibility
s, c = req('/api/organizer/visibility', 'POST', {'published': True}, {'Cookie': 'session=org_7f2a'})
assert s == 200 and c.get('results_published') is True, f"Visibility failed: {s}"
print('10. POST /api/organizer/visibility: PASS')

# 11. Webhooks
s, c = req('/api/webhooks', 'POST', {'url': 'https://example.com/webhook', 'event_types': 'project.submitted'}, {'Cookie': 'session=org_7f2a'})
assert s == 201 and c.get('id'), f"Webhook creation failed: {s}"
s, c = req('/api/webhooks', headers={'Cookie': 'session=org_7f2a'})
assert s == 200 and len(c) > 0, f"Webhook list failed: {s}"
print('11. /api/webhooks: PASS')

# 12. Certificates
s, c = req('/api/certificates/judge', 'POST', {'judge_id': 'jdg_01'}, {'Cookie': 'session=jdg_a_91bc'})
assert s == 201 and c.get('record_id'), f"Certificate issue failed: {s}"
rec_id = c['record_id']
print(f'12. POST /api/certificates/judge ({rec_id}): PASS')

# 13. Verify Certificate
s, c = req(f'/verify/{rec_id}')
assert s == 200 and 'CRYPTOGRAPHICALLY VERIFIED' in c, f"Verify certificate failed: {s}"
print('13. GET /verify/<id>: PASS')

# 14. Bulk JSON Export
s, c = req('/api/export/bulk.json', headers={'Cookie': 'session=org_7f2a'})
assert s == 200 and len(c.get('projects', [])) >= 40, f"Bulk JSON export failed: {s}"
print('14. GET /api/export/bulk.json: PASS')

print('>>> ALL 14 EXTENDED ENDPOINTS VERIFIED AND OPERATIONAL! <<<')
