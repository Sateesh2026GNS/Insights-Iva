import InviteUserModal from "./InviteUserModal";

export default function AddUserModal({
  open,
  onClose,
  onSuccess,
  defaultRole = "Operator",
  title = "Invite User",
}) {
  return (
    <InviteUserModal
      open={open}
      onClose={onClose}
      onSuccess={onSuccess}
      defaultRole={defaultRole}
      title={title}
    />
  );
}
