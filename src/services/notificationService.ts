export const notificationService = {
  /**
   * Sends a notification to the guardian about 5 consecutive absences.
   * In a real application, this should be handled by a secure backend 
   * (e.g., Supabase Edge Function or Vercel API Route) using Resend.
   * Doing it from the frontend exposes the API key.
   */
  async sendConsecutiveAbsenceNotification(
    guardianEmail: string,
    guardianName: string,
    studentName: string,
    courseId: string,
  ) {
    console.warn(`[NOTIFICATION] Sending email via Resend to ${guardianEmail}...`);
    
    // Example of how it could be called if we had an API route /api/send-email:
    /*
    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: guardianEmail,
          subject: `Urgent: Attendance Alert for ${studentName}`,
          text: `Dear ${guardianName}, your ward ${studentName} has missed 5 consecutive attendance sessions for course ${courseId}.`
        })
      });
    } catch (error) {
      console.error("Failed to send notification:", error);
    }
    */
    
    console.log(`[SUCCESS] Email notification logged for ${studentName} to ${guardianEmail}.`);
  }
};
