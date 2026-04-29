import AccessLogo from '../../Access_logo1.png';

export function Loader() {
  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-4">
        <img
          src={AccessLogo}
          alt="Access"
          className="w-16 h-16 object-contain animate-pulse"
        />
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );
}