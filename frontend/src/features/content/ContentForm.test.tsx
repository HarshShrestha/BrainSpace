import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContentForm } from './ContentForm';
describe('ContentForm', () => {
  it('submits validated content and normalizes tags', async () => {
    const save = vi.fn().mockResolvedValue(undefined), close = vi.fn();
    render(<ContentForm onSave={save} onClose={close} />); const user = userEvent.setup();
    await user.type(screen.getByLabelText('Title'), 'An idea');
    await user.type(screen.getByLabelText('Link'), 'https://example.org');
    await user.type(screen.getByLabelText(/Tags/), 'reading, design');
    await user.click(screen.getByRole('button', { name: 'Save to space' }));
    expect(save).toHaveBeenCalledWith({ title: 'An idea', link: 'https://example.org', type: 'article', tags: ['reading', 'design'] });
    expect(close).toHaveBeenCalled();
  });
  it('shows server errors and does not close', async () => {
    const close = vi.fn(); render(<ContentForm onSave={vi.fn().mockRejectedValue(new Error('Cannot save'))} onClose={close} />);
    const user = userEvent.setup(); await user.type(screen.getByLabelText('Title'), 'An idea'); await user.type(screen.getByLabelText('Link'), 'https://example.org'); await user.click(screen.getByRole('button', { name: 'Save to space' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot save'); expect(close).not.toHaveBeenCalled();
  });
  it('closes with Escape', async () => { const close = vi.fn(); render(<ContentForm onSave={vi.fn()} onClose={close} />); await userEvent.keyboard('{Escape}'); expect(close).toHaveBeenCalled(); });
});
