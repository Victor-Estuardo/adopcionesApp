type Props = { title: string; description: string };

export const ErrorBoundaryAlert = (props: Props) => {
  const { title, description } = props;

  return (
    <div className="w-1/2 mx-auto pt-4">
      <div className="p-4 border border-red-200 text-red-900 bg-red-100 rounded-md">
        <h4 className="text-md leading-6 font-medium">{title}</h4>
        <p className="text-sm">{description}</p>
      </div>
    </div>
  );
};
