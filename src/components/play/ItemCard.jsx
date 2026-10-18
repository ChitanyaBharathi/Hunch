import { useState } from 'react';

const TINT = { Tech: 'var(--blue)', Fashion: 'var(--pink)', Beauty: 'var(--lilac)', Home: 'var(--yellow)', 'Food & Drink': '#ffb37a',
  Sports: 'var(--mint)', Hobbies: '#ffd6a5', Everyday: '#d8e2dc', Experiences: '#a0e7e5' };

export function ItemCard({ product }) {
  const [failed, setFailed] = useState(false);
  if (!product) return null;
  const photo = product.imageUrl;
  const showPhoto = photo && !failed;
  return (
    <div className="item-card card">
      <div className="item-image-wrapper" style={showPhoto ? undefined : { background: TINT[product.category] ?? 'var(--yellow)' }}>
        {showPhoto
          ? <img src={photo} alt={product.title} className="item-image" loading="eager" onError={() => setFailed(true)} />
          : <div className="item-illustration" role="img" aria-label={product.title}><span className="item-illustration-name" aria-hidden="true">{product.title}</span></div>}
        <div className="item-category-overlay">
          <span className="chip">{product.category}</span>
        </div>
      </div>
      <div className="item-details">
        <p className="eyebrow">{product.brand ? product.brand.toUpperCase() : 'ON THE GUESS LIST'}</p>
        <h2 className="item-title">{product.title}</h2>
        <p className="item-description caption">{product.description}</p>
        {showPhoto && <small className="item-image-note">{product.imageCredit ? `Photo: ${product.imageCredit} · ` : ''}Use the description for your guess</small>}
      </div>
    </div>
  );
}
