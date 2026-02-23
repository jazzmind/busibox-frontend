import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ClientManagement from './ClientManagement';

// Mock fetch globally
global.fetch = vi.fn();

describe('ClientManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the client management interface', async () => {
    // Mock successful API response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ servers: [] }),
    });

    render(<ClientManagement />);
    
    // Wait for the component to finish loading
    await waitFor(() => {
      expect(screen.getByText('Registered Clients')).toBeInTheDocument();
      expect(screen.getByText('Add New Client')).toBeInTheDocument();
      expect(screen.getByText('No clients registered yet.')).toBeInTheDocument();
    });
  });

  it('displays loading state initially', () => {
    // Mock pending API response
    (global.fetch as any).mockImplementation(() => new Promise(() => {}));

    render(<ClientManagement />);
    
    // Check for loading spinner by class name
    const loadingSpinner = document.querySelector('.animate-spin');
    expect(loadingSpinner).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    // Mock API error
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Server error' }),
    });

    render(<ClientManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });

  it('opens add client form when button is clicked', async () => {
    // Mock successful API response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ servers: [] }),
    });

    render(<ClientManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Add New Client')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add New Client'));
    
    expect(screen.getByText('Client ID')).toBeInTheDocument();
    expect(screen.getByText('Display Name')).toBeInTheDocument();
    expect(screen.getByText('Scopes')).toBeInTheDocument();
  });

  it('displays clients when data is available', async () => {
    const mockClients = [
      {
        serverId: 'test-client-1',
        name: 'Test Client 1',
        scopes: ['weather.read', 'weather.write'],
        createdAt: '2023-01-01T00:00:00Z',
        registeredBy: 'admin',
      },
      {
        serverId: 'test-client-2',
        name: 'Test Client 2',
        scopes: ['agent.execute'],
        createdAt: '2023-01-02T00:00:00Z',
        registeredBy: 'admin',
      },
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ servers: mockClients }),
    });

    render(<ClientManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Client 1')).toBeInTheDocument();
      expect(screen.getByText('test-client-1')).toBeInTheDocument();
      expect(screen.getByText('weather.read')).toBeInTheDocument();
      expect(screen.getByText('weather.write')).toBeInTheDocument();
      
      expect(screen.getByText('Test Client 2')).toBeInTheDocument();
      expect(screen.getByText('test-client-2')).toBeInTheDocument();
      expect(screen.getByText('agent.execute')).toBeInTheDocument();
    });
  });
});
