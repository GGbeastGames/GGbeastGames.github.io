type TokenCardProps = {
  label: string;
  value: string;
};

export function TokenCard({ label, value }: TokenCardProps) {
  const isColor = value.startsWith('#') || value.startsWith('rgb');

  return (
    <div className="token-card">
      <p>{label}</p>
      <strong>{value}</strong>
      {isColor ? <span className="token-swatch" style={{ background: value }} /> : null}
    </div>
  );
}
