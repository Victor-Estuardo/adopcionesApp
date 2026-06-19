import { IconType } from "react-icons";

type PrimaryButtonProps = {
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  Icon?: IconType;
  label: string;
};

export function PrimaryButton({
  disabled,
  onClick,
  Icon,
  label,
}: PrimaryButtonProps) {
  return (
    <button
      className="bg-medium-turquoise-meraki px-4 py-2 text-white rounded-full disabled:opacity-60 disabled:cursor-not-allowed"
      onClick={onClick}
      disabled={disabled}
    >
      {Icon && <Icon />}
      {label}
    </button>
  );
}
