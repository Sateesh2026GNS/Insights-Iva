"""Live test: try to push Meeting 1 to Google Calendar and print the exact error."""
import sys
sys.path.insert(0, ".")

from app.core.database import SessionLocal
from app.models.meeting import Meeting, GoogleCalendarCredential
from app.services import google_calendar_service as gcal
from sqlalchemy import select

def main():
    db = SessionLocal()

    # Get credentials
    cred_rows = db.scalars(select(GoogleCalendarCredential)).all()
    print(f"Credentials: {len(cred_rows)}")
    for r in cred_rows:
        print(f"  tenant={r.tenant_id} user={r.user_id} email={r.google_account_email} refresh={bool(r.refresh_token)}")

    # Get the meeting
    meeting = db.scalars(select(Meeting)).first()
    if not meeting:
        print("No meetings found!")
        db.close()
        sys.exit(1)

    print(f"\nMeeting: id={meeting.id} title={meeting.title} date={meeting.meeting_date} start={meeting.start_time} end={meeting.end_time} tz={meeting.timezone}")

    tenant_id = cred_rows[0].tenant_id
    user_id = cred_rows[0].user_id

    print(f"\nTrying to sync to Google Calendar (tenant={tenant_id}, user={user_id})...")

if __name__ == "__main__":
    main()
try:
    # Try to get valid credentials
    row, creds = gcal.get_valid_credentials(db, tenant_id=tenant_id, user_id=user_id)
    print(f"Got valid credentials! Token valid: {not creds.expired}")
    
    # Build the event body
    body = gcal._build_event_body(meeting, include_meet=True, request_id="test-123")
    print(f"Event body: {body}")
    
    # Actually insert the event
    service = gcal._calendar_service(creds)
    event = (
        service.events()
        .insert(
            calendarId="primary",
            body=body,
            conferenceDataVersion=1,
            sendUpdates="all",
        )
        .execute()
    )
    print(f"\n✅ SUCCESS! Event created!")
    print(f"  Event ID: {event.get('id')}")
    print(f"  Event URL: {event.get('htmlLink')}")
    print(f"  Meet URL: {event.get('hangoutLink')}")
    
    # Save back to meeting
    gcal._apply_event_to_meeting(meeting, event, requested_meet=True)
    db.commit()
    print(f"\nMeeting updated in DB: gcal_event_id={meeting.google_calendar_event_id}")
    
except Exception as e:
    print(f"\n❌ ERROR: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

db.close()
