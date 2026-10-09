import './Button.css';

export default function Button({ variant = 'primary', size = 'md', as: As = 'button', className = '', ...rest }) {
  return <As className={`sp-btn sp-btn--${variant} sp-btn--${size} ${className}`} {...rest} />;
}
