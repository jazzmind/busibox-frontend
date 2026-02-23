import type { Meta, StoryObj } from '@storybook/react';
import { within, userEvent, expect, fn } from '@storybook/test';
import Home from './page';

// Mock fetch for Storybook
const mockFetch = fn();

// Set up global fetch mock
beforeEach(() => {
  global.fetch = mockFetch;
});

const meta: Meta<typeof Home> = {
  title: 'Pages/HomePage',
  component: Home,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'The main chat interface for interacting with the weather agent.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Default state showing the chat interface with initial assistant message.',
      },
    },
  },
};

export const WithUserMessage: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Mock successful API response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        text: 'The current weather in New York is 72°F with clear skies. Perfect for outdoor activities!',
      }),
    });
    
    // Find the input and send button
    const input = canvas.getByPlaceholderText('Ask about weather in any city...');
    const sendButton = canvas.getByText('Send');
    
    // Type a message
    await userEvent.type(input, 'What is the weather in New York?');
    
    // Send the message
    await userEvent.click(sendButton);
    
    // Wait for the message to appear
    await expect(canvas.getByText('What is the weather in New York?')).toBeInTheDocument();
    
    // Wait for assistant response
    await expect(canvas.getByText(/The current weather in New York is 72°F/)).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows the chat flow when a user sends a message and receives a response.',
      },
    },
  },
};

export const LoadingState: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Mock delayed API response
    mockFetch.mockImplementation(() => 
      new Promise(() => {}) // Never resolves to show loading state
    );
    
    // Find the input and send button
    const input = canvas.getByPlaceholderText('Ask about weather in any city...');
    const sendButton = canvas.getByText('Send');
    
    // Type a message
    await userEvent.type(input, 'What is the weather like?');
    
    // Send the message
    await userEvent.click(sendButton);
    
    // Check for loading state
    await expect(canvas.getByText('Weather assistant is typing...')).toBeInTheDocument();
    await expect(canvas.getByText('Sending...')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows the loading state while waiting for the assistant response.',
      },
    },
  },
};

export const ErrorState: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Mock API error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        error: 'Service temporarily unavailable',
      }),
    });
    
    // Find the input and send button
    const input = canvas.getByPlaceholderText('Ask about weather in any city...');
    const sendButton = canvas.getByText('Send');
    
    // Type a message
    await userEvent.type(input, 'What is the weather?');
    
    // Send the message
    await userEvent.click(sendButton);
    
    // Wait for error message
    await expect(canvas.getByText(/Sorry, there was an error connecting to the weather service/)).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows how errors are handled when the API request fails.',
      },
    },
  },
};

export const UsingSuggestions: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Find the input and a suggestion button
    const input = canvas.getByPlaceholderText('Ask about weather in any city...');
    const suggestion = canvas.getByText('Weather in New York');
    
    // Click the suggestion
    await userEvent.click(suggestion);
    
    // Verify the input is filled
    await expect(input).toHaveValue('Weather in New York');
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows how suggestion buttons can be used to quickly fill the input field.',
      },
    },
  },
};

export const ConversationFlow: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Mock multiple API responses
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          text: 'The weather in London is currently 18°C with light rain. You might want to bring an umbrella!',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          text: 'For rainy weather in London, I recommend visiting museums like the British Museum or Tate Modern, enjoying a cozy pub lunch, or catching a West End show!',
        }),
      });
    
    // First message
    const input = canvas.getByPlaceholderText('Ask about weather in any city...');
    const sendButton = canvas.getByText('Send');
    
    await userEvent.type(input, 'Weather in London');
    await userEvent.click(sendButton);
    
    // Wait for first response
    await expect(canvas.getByText(/The weather in London is currently 18°C/)).toBeInTheDocument();
    
    // Second message
    await userEvent.type(input, 'What activities would you recommend?');
    await userEvent.click(sendButton);
    
    // Wait for second response
    await expect(canvas.getByText(/For rainy weather in London, I recommend/)).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates a full conversation flow with multiple exchanges.',
      },
    },
  },
};
