import React from 'react';

interface CollateralSelectorProps { onSelect: (collateral: { asset: string; amount: string }) => void; }

const CollateralSelector: React.FC<CollateralSelectorProps> = ({ onSelect }) => <div className="flex gap-2"><select defaultValue="ETH" onChange={(event) => onSelect({ asset: event.target.value, amount: '' })} className="rounded border p-2"><option value="ETH">ETH</option></select><input type="number" min="0" step="any" placeholder="Collateral amount" onChange={(event) => onSelect({ asset: 'ETH', amount: event.target.value })} className="flex-1 rounded border p-2" /></div>;

export default CollateralSelector;
