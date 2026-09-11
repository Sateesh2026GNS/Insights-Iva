import { Check, Plus, Upload, UserRound } from "lucide-react";
import Button from "../common/Button";
import { KEY_BENEFITS } from "../../utils/customerListViews";

function CustomerEmptyIcon() {
  return (
    <div className="customers-empty__icon-wrap" aria-hidden>
      <div className="customers-empty__icon-circle">
        <UserRound className="customers-empty__icon-user" strokeWidth={1.25} />
      </div>
      <div className="customers-empty__icon-badge">
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
      </div>
    </div>
  );
}

export default function CustomersEmptyState({ onCreate, onImport, showBenefits = true }) {
  return (
    <div className="customers-empty">
      <div className="customers-empty__hero">
        <CustomerEmptyIcon />
        <h2 className="customers-empty__title">Every sale starts with a customer</h2>
        <p className="customers-empty__subtitle">
          Create and manage your customers and their contact persons, all in one place.
        </p>
        <div className="customers-empty__actions">
          <Button
            variant="add"
            type="button"
            onClick={onCreate}
            leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}
          >
            Create New Customer
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={onImport}
            leftIcon={<Upload className="h-4 w-4" aria-hidden />}
          >
            Import File
          </Button>
        </div>
      </div>

      {showBenefits ? (
        <div className="customers-empty__benefits">
          <p className="customers-empty__benefits-title">
            <span aria-hidden>👋</span>
            Key Benefits
          </p>
          <ul className="customers-empty__benefits-grid">
            {KEY_BENEFITS.map((item) => (
              <li key={item}>
                <Check className="customers-empty__benefits-check" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
