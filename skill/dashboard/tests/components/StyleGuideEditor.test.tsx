import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StyleGuideEditor } from '../../src/components/StyleGuideEditor';
import * as api from '../../src/lib/api';

vi.mock('../../src/lib/api', () => ({
    fetchStyleGuide: vi.fn(),
    saveStyleGuide: vi.fn()
}));

const mockedApi = vi.mocked(api);

const INITIAL_CONTENT = '# Initial style guide\n\n## DO\n- existing rule\n';
const INITIAL_HASH = 'abc123def456';

beforeEach(() => {
    mockedApi.fetchStyleGuide.mockReset();
    mockedApi.saveStyleGuide.mockReset();
});

describe('StyleGuideEditor', () => {
    it('loads initial content into textarea', () => {
        render(<StyleGuideEditor initialContent={INITIAL_CONTENT} initialHash={INITIAL_HASH} />);

        const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
        expect(textarea.value).toBe(INITIAL_CONTENT);
        expect(screen.getByText(/Loaded/)).toBeInTheDocument();
        expect(screen.getByText(/abc123de/)).toBeInTheDocument();
    });

    it('Save button disabled when no changes', () => {
        render(<StyleGuideEditor initialContent={INITIAL_CONTENT} initialHash={INITIAL_HASH} />);

        const saveBtn = screen.getByRole('button', { name: 'Save' });
        expect(saveBtn).toBeDisabled();
    });

    it('Save button enabled after edit', async () => {
        const user = userEvent.setup();
        render(<StyleGuideEditor initialContent={INITIAL_CONTENT} initialHash={INITIAL_HASH} />);

        const textarea = screen.getByRole('textbox');
        await user.type(textarea, ' edited');

        const saveBtn = screen.getByRole('button', { name: 'Save' });
        expect(saveBtn).toBeEnabled();
        expect(screen.getByText(/Unsaved changes/)).toBeInTheDocument();
    });

    it('Save button disabled again when edits are reverted to baseline', async () => {
        const user = userEvent.setup();
        render(<StyleGuideEditor initialContent={INITIAL_CONTENT} initialHash={INITIAL_HASH} />);

        const textarea = screen.getByRole('textbox');
        const saveBtn = screen.getByRole('button', { name: 'Save' });
        expect(saveBtn).toBeDisabled();

        await user.type(textarea, ' x');
        expect(saveBtn).toBeEnabled();

        // delete the appended chars to return to baseline
        await user.type(textarea, '{Backspace}{Backspace}');
        expect(saveBtn).toBeDisabled();
    });

    it('saves edit + updates hash + shows Saved at timestamp', async () => {
        const user = userEvent.setup();
        mockedApi.saveStyleGuide.mockResolvedValue({ contentHash: 'newhash999' });

        render(<StyleGuideEditor initialContent={INITIAL_CONTENT} initialHash={INITIAL_HASH} />);

        const textarea = screen.getByRole('textbox');
        await user.clear(textarea);
        await user.type(textarea, '# Modified\n\n## DO\n- new rule');

        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(mockedApi.saveStyleGuide).toHaveBeenCalledTimes(1);
        });
        expect(mockedApi.saveStyleGuide).toHaveBeenCalledWith(
            '# Modified\n\n## DO\n- new rule',
            INITIAL_HASH
        );
        await waitFor(() => {
            expect(screen.getByText(/Saved at/)).toBeInTheDocument();
        });
        expect(screen.getByText(/newhash9/)).toBeInTheDocument();
    });

    it('shows Conflict detected when saveStyleGuide throws CONFLICT', async () => {
        const user = userEvent.setup();
        const conflict = new Error('hash mismatch') as Error & { code?: string };
        conflict.code = 'CONFLICT';
        mockedApi.saveStyleGuide.mockRejectedValue(conflict);

        render(<StyleGuideEditor initialContent={INITIAL_CONTENT} initialHash={INITIAL_HASH} />);

        await user.type(screen.getByRole('textbox'), ' edit');
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(screen.getByText(/Conflict detected/i)).toBeInTheDocument();
        });
        expect(screen.getByRole('button', { name: /Reload latest/i })).toBeInTheDocument();
    });

    it('Reload latest fetches fresh content + clears conflict', async () => {
        const user = userEvent.setup();
        const conflict = new Error('hash mismatch') as Error & { code?: string };
        conflict.code = 'CONFLICT';
        mockedApi.saveStyleGuide.mockRejectedValue(conflict);
        mockedApi.fetchStyleGuide.mockResolvedValue({
            content: '# Fresh from vault\n',
            contentHash: 'freshhash000'
        });

        render(<StyleGuideEditor initialContent={INITIAL_CONTENT} initialHash={INITIAL_HASH} />);

        await user.type(screen.getByRole('textbox'), ' edit');
        await user.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => {
            expect(screen.getByText(/Conflict detected/i)).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: /Reload latest/i }));

        await waitFor(() => {
            expect(mockedApi.fetchStyleGuide).toHaveBeenCalledTimes(1);
        });
        const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
        await waitFor(() => {
            expect(textarea.value).toBe('# Fresh from vault\n');
        });
        expect(screen.queryByText(/Conflict detected/i)).not.toBeInTheDocument();
    });

    it('shows error message when save throws non-conflict error', async () => {
        const user = userEvent.setup();
        mockedApi.saveStyleGuide.mockRejectedValue(new Error('network down'));

        render(<StyleGuideEditor initialContent={INITIAL_CONTENT} initialHash={INITIAL_HASH} />);

        await user.type(screen.getByRole('textbox'), ' x');
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(screen.getByText('network down')).toBeInTheDocument();
        });
    });
});
