import type { Meta, StoryObj } from '@storybook/react';
import { within, userEvent, expect, fn } from '@storybook/test';
import ClientManagement from './ClientManagement';

// Mock fetch for Storybook
const mockFetch = fn();

const meta: Meta<typeof ClientManagement> = {
  title: 'Admin/ClientManagement',
  component: ClientManagement,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'A component for managing OAuth 2.0 clients in the agent server system.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Mock data
const mockClients = [
  {
    serverId: 'weather-client',
    name: 'Weather Application',
    scopes: ['weather.read', 'weather.write'],
    createdAt: '2023-12-01T10:00:00Z',
    registeredBy: 'admin',
  },
  {
    serverId: 'agent-runner',
    name: 'Agent Runner Service',
    scopes: ['agent.execute', 'workflow.execute'],
    createdAt: '2023-12-02T14:30:00Z',
    registeredBy: 'admin',
  },
  {
    serverId: 'admin-dashboard',
    name: 'Admin Dashboard',
    scopes: ['admin.read', 'admin.write'],
    createdAt: '2023-12-03T09:15:00Z',
    registeredBy: 'admin',
  },
];

export const Default: Story = {
  play: async () => {
    // Mock successful API response with clients
    if (typeof window !== 'undefined') {
      global.fetch = mockFetch;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ servers: mockClients }),
      });
    }
  },
};

export const Loading: Story = {
  play: async () => {
    // Mock delayed response to show loading state
    mockFetch.mockImplementation(() => 
      new Promise(() => {}) // Never resolves to keep loading state
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows the loading state while fetching clients from the server.',
      },
    },
  },
};

export const Empty: Story = {
  play: async () => {
    // Mock empty response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ servers: [] }),
    });
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows the empty state when no clients are registered.',
      },
    },
  },
};

export const WithError: Story = {
  play: async () => {
    // Mock error response
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Failed to connect to server' }),
    });
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows how errors are displayed when the API request fails.',
      },
    },
  },
};

export const AddClientForm: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Mock successful clients fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ servers: mockClients }),
    });
    
    // Wait for component to load
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Click the "Add New Client" button
    const addButton = canvas.getByText('Add New Client');
    await userEvent.click(addButton);
    
    // Verify form is visible
    await expect(canvas.getByText('Client ID')).toBeInTheDocument();
    await expect(canvas.getByText('Display Name')).toBeInTheDocument();
    await expect(canvas.getByText('Scopes')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows the add client form when the "Add New Client" button is clicked.',
      },
    },
  },
};

export const WithManyClients: Story = {
  play: async () => {
    // Mock response with many clients
    const manyClients = Array.from({ length: 10 }, (_, i) => ({
      serverId: `client-${i + 1}`,
      name: `Client ${i + 1}`,
      scopes: ['weather.read', 'agent.execute'],
      createdAt: new Date(2023, 11, i + 1).toISOString(),
      registeredBy: 'admin',
    }));
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ servers: manyClients }),
    });
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows how the component handles displaying many clients in a table format.',
      },
    },
  },
};
