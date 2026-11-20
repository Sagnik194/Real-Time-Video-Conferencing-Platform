import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: () => ({
      interceptors: { request: { use: jest.fn() } },
      get: jest.fn(),
      post: jest.fn(),
    }),
  },
}));

test('renders the video conferencing landing page', () => {
  render(<App />);
  expect(screen.getByText('Smeet')).toBeInTheDocument();
  expect(screen.getByText(/get started/i)).toBeInTheDocument();
});
