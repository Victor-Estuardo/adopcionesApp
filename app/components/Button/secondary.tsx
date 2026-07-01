import { IconType } from "react-icons";

type SecondaryButtonProps = {
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  Icon?: IconType;
  label: string;
  color?: string;
  textColor?: string;
  borderColor?: string;
  width?: string;
};

export function SecondaryButton({
  disabled,
  onClick,
  Icon,
  label,
  color,
  textColor = "text-medium-turquoise-meraki",
  borderColor = "border-medium-turquoise-meraki",
  width = "",
}: SecondaryButtonProps) {
  return (
    <button
      className={`${
        Icon ? "flex items-center gap-x-2" : ""
      } border px-6 py-2 rounded-full ${width} ${color} ${textColor} ${borderColor}`}
      onClick={onClick}
      disabled={disabled}
    >
      {Icon && <Icon />}
      {label}
    </button>
  );
}
