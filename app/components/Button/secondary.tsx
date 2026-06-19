import { IconType } from "react-icons";

type SecondaryButtonProps = {
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  Icon?: IconType;
  label: string;
  color?: string;
  textColor?: string;
  borderColor?: string;
};

export function SecondaryButton({
  disabled,
  onClick,
  Icon,
  label,
  color,
  textColor = "text-medium-turquoise-meraki",
  borderColor = "border-medium-turquoise-meraki",
}: SecondaryButtonProps) {
  return (
    <button
      className={`flex items-center gap-x-2 border px-6 py-2 rounded-full ${color} ${textColor} ${borderColor}`}
      onClick={onClick}
      disabled={disabled}
    >
      {Icon && <Icon />}
      {label}
    </button>
  );
}
