// FAQ dari kendala nyata selama placement test (Oktober 2026), dikelompokkan per tahap.
// Dipakai di halaman FAQ, bantuan ruang tes, dan saran AI pada tiket (8.8).
export type FaqGroup = [string, [string, string][]];
export const PARTICIPANT_FAQ: FaqGroup[] = [
  ["Before the test", [
    ["The Start button cannot be clicked", "The page lists what is still missing above the Start button: play the test tone and tick that you hear it, read and accept the rules, and share your entire screen if the test asks for it. Start becomes active once everything is done."],
    ["Screen sharing fails or is blocked", "Choose “Entire screen”, not a window or tab. On macOS allow screen recording for your browser in System Settings → Privacy & Security, then reopen the browser. Office laptops may block screen sharing; use a personal laptop if possible."],
    ["Which device and browser should I use?", "A laptop or PC with the latest Chrome or Edge, a stable connection, and a headset. Phones are not supported for tests that require screen sharing."],
    ["I cannot sign in", "Use the email registered by your institution and sign in with your password or an email code (OTP). If too many wrong passwords lock the account, reset your password; the lock is removed automatically."],
    ["The email code (OTP) or invitation does not arrive", "Check the spam folder and wait a minute. Codes are valid for 5 minutes; always use the code from the latest email. Invitations can be resent by your institution."],
  ]],
  ["During the test", [
    ["The page shows “Saving your answer… Do not refresh”", "Your connection is slow and the answer is still being saved. Wait until it disappears; do not refresh or close the page. Answers are only lost if you leave before saving finishes."],
    ["I cannot go back to earlier questions", "This test runs in one-way (secure) mode: once you move on, you cannot return. Answer each question before pressing Next."],
    ["The Listening audio is silent or stops", "Check the volume and headset, then press “No sound? Switch audio player”. It continues from the current position. The audio is downloaded before it plays, so a short network drop does not cut the sound."],
    ["My connection dropped or the browser closed", "Sign in again and open My Tests → Continue. Saved answers stay, and time lost while offline is returned (up to 10 minutes per section)."],
  ]],
  ["After the test", [
    ["When will I see my result?", "Results are announced by your program organizer. Until then Test Results shows that your test has been received. You will get an email when the result is released."],
    ["Other menus are missing", "Learning menus appear after your placement result is released and your level is set."],
  ]],
];

// Institusi dan coach: pertanyaan umum seputar portal; dipakai di halaman Help & support.
export const INSTITUTION_FAQ: FaqGroup[] = [
  ["Participants", [
    ["How do I add participants?", "Open Participants & invitations → Add participants. You can invite by email or upload an Excel list. Each participant receives an invitation email to create an account."],
    ["A participant did not receive the invitation", "Ask them to check the spam folder first. You can resend the invitation from Participants & invitations. Make sure the email address is spelled correctly."],
    ["A participant cannot sign in", "They can sign in with their password or an email code (OTP), and reset the password themselves. If it still fails, send a request here with their email address."],
  ]],
  ["Tests and schedule", [
    ["How do participants pick a test session?", "Open Group test schedule to see the sessions and seats for your participants. Participants choose or are assigned a session; changes appear in the schedule."],
    ["How can I follow a test that is running?", "Monitoring & Proctoring shows who has not started, who is working, who lost connection, and who has finished."],
    ["A participant had a problem during the test", "Send a request with category “Problem during the test” and the participant's email. Our team can check the connection log and extend, reset, or reschedule if needed."],
  ]],
  ["Results and reports", [
    ["When are results visible?", "Results appear in Reports once they are released by the program organizer."],
    ["How do I download reports?", "Reports offers the participant report in Excel and the group report in PDF."],
  ]],
];

export const COACH_FAQ: FaqGroup[] = [
  ["Participants and sessions", [
    ["Where are my participants?", "My participants lists everyone assigned to you, with their latest result and progress."],
    ["How do I record attendance?", "Open Sessions & attendance, choose the session, and mark each participant. This menu is available when coaching is turned on for the institution."],
    ["How do I set my available slots?", "Open Slot schedule and add the times you are available. Participants can book from these slots."],
    ["A participant is assigned to the wrong coach", "Send a request with the participant's email; the admin can move them."],
  ]],
];
