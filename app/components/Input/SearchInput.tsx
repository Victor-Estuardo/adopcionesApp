import { IoCloseOutline, IoSearchOutline } from "react-icons/io5";

type SearchInputProp = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "className"
> & {
  isClearable?: boolean;
  onClearable?: () => void;
};

export default (props: SearchInputProp) => {
  const { isClearable, onClearable, value } = props;
  return (
    <div className="relative flex-1 md:w-72">
      <IoSearchOutline className="absolute left-2 top-1/2 trasform -translate-y-1/2 pointer-events-none w-5 h-5 text-gray-400" />
      <input
        {...props}
        className="w-full h-10 pl-10 pr-9 rounded-xl border border-gray-200 bg-gray-50 text-sm placeholder:text-gray-400 outline-none transition-colors focus:border-blue-meraki focus:bg-white focus:ring-2 focus:ring-blue-meraki/20"
      />
      {isClearable && value && (
        <button
          type="button"
          aria-label="Limpiar búsqueda"
          onClick={onClearable}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
        >
          <IoCloseOutline className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
