import { IoSearchOutline } from "react-icons/io5";

type SearchIconProp = {
  value?: string | number | readonly string[];
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
};

export default (props: SearchIconProp) => {
  const { onChange, value } = props;
  return (
    <div className="relative">
      <input
        type="text"
        className="py-1 pr-2 pl-8 border border-peach-meraki rounded-lg focus:outline-pink-meraki"
        value={value}
        onChange={onChange}
      />
      <IoSearchOutline className="absolute left-2 top-1/2 trasform -translate-y-1/2" />
    </div>
  );
};
