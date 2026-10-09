import './Button.css';

export default function Button({ variant = 'primary', size = 'md', as: As = 'button', className = '', ...rest }) {
  return <As className={`si-btn si-btn--${variant} si-btn--${size} ${className}`} {...rest} />;
}
