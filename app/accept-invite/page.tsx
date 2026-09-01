import { SetPasswordForm } from "@/components/SetPasswordForm";

export default function AcceptInvitePage() {
  return (
    <SetPasswordForm
      heading="Set your password"
      ctaLabel="Set password & continue"
      invalidLinkMessage="This invite link is invalid or has expired. Ask an admin to send a new one."
    />
  );
}
