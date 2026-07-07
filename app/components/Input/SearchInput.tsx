import { IoSearchOutline } from "react-icons/io5";

type SearchIconProp = {
  value?: string | number | readonly string[];
  placeholder?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  size?: "base" | "lg";
};

export default (props: SearchIconProp) => {
  const { onChange, value, placeholder, size = "base" } = props;

  const sizeStyle = {
    base: "",
    lg: "w-full",
  };

  return (
    <div className={`relative ${sizeStyle[size]}`}>
      <input
        type="text"
        placeholder={placeholder}
        className={`${sizeStyle[size]} py-1 pr-2 pl-8 border border-peach-meraki rounded-lg focus:outline-pink-meraki`}
        value={value}
        onChange={onChange}
      />
      <IoSearchOutline className="absolute left-2 top-1/2 trasform -translate-y-1/2" />
    </div>
  );
};
