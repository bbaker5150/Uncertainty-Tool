import { render, screen } from '@testing-library/react';
import App from './App';

test('renders uncertainty analysis heading', () => {
  render(<App />);
  const heading = screen.getByText(/Uncertainty Analysis/i);
  expect(heading).toBeInTheDocument();
});
