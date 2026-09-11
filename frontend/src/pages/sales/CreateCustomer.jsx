import { Navigate } from "react-router-dom";

export default function CreateCustomer() {
  return <Navigate to="/sales/customers/create" replace />;
}
