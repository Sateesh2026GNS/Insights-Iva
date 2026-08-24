import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";

/**
 * Centralized Insights Iva Button.
 * DESIGN ONCE → BUILD ONCE → REUSE EVERYWHERE.
 *
 * Variants:
 *   add       — + Add New / Add Customer / Create New (teal-blue #0F5F78)
 *   primary   — Create / Submit / Save (brand green)
 *   secondary — Cancel / Back / Close
 *   view      — View / Open / Approve / Confirm (#2E9B72)
 *   edit      — Edit / Update (#3182CE)
 *   success   — alias of view (backward compat)
 *   warning   — Hold / Pending / Review Required
 *   danger    — Delete / Remove
 *   outline   — bordered brand accent
 *   ghost     — low priority / icon chrome
 *
 * Sizes: sm | md | lg | icon
 */

export const BUTTON_VARIANTS = [
  "add",
  "primary",
  "secondary",
  "view",
  "edit",
  "success",
  "warning",
  "danger",
  "outline",
  "ghost",
];

const VARIANT_CLASS = {
  add: "ui-btn--add",
  primary: "ui-btn--primary",
  secondary: "ui-btn--secondary",
  view: "ui-btn--view",
  edit: "ui-btn--edit",
  success: "ui-btn--success",
  warning: "ui-btn--warning",
  danger: "ui-btn--danger",
  outline: "ui-btn--outline",
  ghost: "ui-btn--ghost",
  /** @deprecated aliases — map to canonical variants */
  cta: "ui-btn--warning",
  hr: "ui-btn--primary",
};

const SIZE_CLASS = {
  sm: "ui-btn--sm",
  md: "",
  lg: "ui-btn--lg",
  icon: "ui-btn--icon",
};

function Spinner() {
  return (
    <span
      className="ui-btn__spinner"
      aria-hidden
    />
  );
}

const Button = forwardRef(function Button(
  {
    children,
    variant = "secondary",
    size = "md",
    className = "",
    loading = false,
    disabled = false,
    type = "button",
    as,
    to,
    href,
    fullWidth = false,
    leftIcon,
    rightIcon,
    "aria-label": ariaLabel,
    ...props
  },
  ref,
) {
  const variantClass = VARIANT_CLASS[variant] || VARIANT_CLASS.secondary;
  const sizeClass = SIZE_CLASS[size] || "";
  const classes = [
    "ui-btn",
    variantClass,
    sizeClass,
    fullWidth ? "ui-btn--block" : "",
    loading ? "is-loading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {loading ? <Spinner /> : leftIcon || null}
      {children}
      {!loading && rightIcon ? rightIcon : null}
    </>
  );

  const shared = {
    ref,
    className: classes,
    "aria-busy": loading || undefined,
    "aria-disabled": disabled || loading || undefined,
    "aria-label": ariaLabel,
    ...props,
  };

  const isDisabled = disabled || loading;

  // Polymorphic: Link / anchor / button
  if (as === Link || (to != null && as == null && !href)) {
    if (isDisabled) {
      return (
        <span {...shared} role="link" aria-disabled="true">
          {content}
        </span>
      );
    }
    return (
      <Link to={to} {...shared}>
        {content}
      </Link>
    );
  }

  if (as === "a" || href != null) {
    if (isDisabled) {
      return (
        <span {...shared} role="link" aria-disabled="true">
          {content}
        </span>
      );
    }
    return (
      <a href={href} {...shared}>
        {content}
      </a>
    );
  }

  if (as && as !== "button") {
    const Comp = as;
    return (
      <Comp {...shared} disabled={isDisabled || undefined}>
        {content}
      </Comp>
    );
  }

  return (
    <button {...shared} type={type} disabled={isDisabled}>
      {content}
    </button>
  );
});

export default Button;

const ADD_PLUS_ICON = <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />;

/** Compact ERP-style “+ Add New” toolbar button (teal-blue). */
export function AddButton({ children, leftIcon, showIcon = true, ...props }) {
  const icon = leftIcon ?? (showIcon ? ADD_PLUS_ICON : undefined);
  return (
    <Button variant="add" leftIcon={icon} {...props}>
      {children}
    </Button>
  );
}

export function PrimaryButton(props) {
  return <Button variant="primary" {...props} />;
}
export function SecondaryButton(props) {
  return <Button variant="secondary" {...props} />;
}
export function ViewButton(props) {
  return <Button variant="view" {...props} />;
}
export function EditButton(props) {
  return <Button variant="edit" {...props} />;
}
export function SuccessButton(props) {
  return <Button variant="success" {...props} />;
}
export function WarningButton(props) {
  return <Button variant="warning" {...props} />;
}
export function DangerButton(props) {
  return <Button variant="danger" {...props} />;
}
export function OutlineButton(props) {
  return <Button variant="outline" {...props} />;
}
export function GhostButton(props) {
  return <Button variant="ghost" {...props} />;
}
export function IconButton({ variant = "ghost", size = "icon", className = "", ...props }) {
  return <Button variant={variant} size={size} className={className} {...props} />;
}
