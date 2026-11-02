import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContentList } from './ContentList';
describe('ContentList', () => {
  it('shows a helpful empty state', () => { render(<ContentList items={[]} />); expect(screen.getByText('Space to think')).toBeInTheDocument(); });
  it('renders safe external links and delegates deletion', async () => {
    const remove = vi.fn(); render(<ContentList onDelete={remove} items={[{ _id: '1', title: 'A link', link: 'https://example.com', type: 'article', createdAt: '2026-01-01', tags: [{ _id: 't', title: 'ideas' }] }]} />);
    expect(screen.getByRole('link', { name: /A link/ })).toHaveAttribute('rel', 'noopener noreferrer'); expect(screen.getByText('#ideas')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete A link' })); expect(remove).toHaveBeenCalledWith('1');
  });
});
