import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from './page';

describe('Dashboard Page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders dashboard and loads agents', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ([]),
    } as any);

    render(<DashboardPage />);

    expect(screen.getByText('Agents')).toBeInTheDocument();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/agents');
    });
  });
});
