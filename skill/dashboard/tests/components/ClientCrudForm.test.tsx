import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClientCrudForm } from '../../src/components/ClientCrudForm';
import * as api from '../../src/lib/api';
import { locationMock } from '../setup';

vi.mock('../../src/lib/api', () => ({
    createClient: vi.fn(),
    updateClient: vi.fn(),
    archiveClient: vi.fn(),
    fetchClients: vi.fn()
}));

const mockedApi = vi.mocked(api);

beforeEach(() => {
    mockedApi.createClient.mockReset();
    mockedApi.updateClient.mockReset();
    mockedApi.archiveClient.mockReset();
    mockedApi.fetchClients.mockReset();
});

describe('ClientCrudForm', () => {
    it('Save button disabled in create modal until slug + name are non-empty', async () => {
        const user = userEvent.setup();
        render(<ClientCrudForm />);

        await user.click(screen.getByRole('button', { name: '+ Add Client' }));

        const saveBtn = await screen.findByRole('button', { name: 'Save' });
        expect(saveBtn).toBeDisabled();

        await user.type(screen.getByLabelText('Slug'), 'foo');
        expect(saveBtn).toBeDisabled();

        await user.type(screen.getByLabelText('Name'), 'Foo');
        expect(saveBtn).toBeEnabled();
    });

    it('opens create modal and submits new client', async () => {
        const user = userEvent.setup();
        mockedApi.createClient.mockResolvedValue({ slug: 'e2e-create', metaPath: '/x' });

        render(<ClientCrudForm />);

        await user.click(screen.getByRole('button', { name: '+ Add Client' }));
        expect(await screen.findByRole('heading', { name: 'New Client' })).toBeInTheDocument();

        await user.type(screen.getByLabelText('Slug'), 'e2e-create');
        await user.type(screen.getByLabelText('Name'), 'E2E Created');
        await user.type(screen.getByLabelText('Notes'), 'test note');

        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(mockedApi.createClient).toHaveBeenCalledTimes(1);
        });
        expect(mockedApi.createClient).toHaveBeenCalledWith(
            expect.objectContaining({
                slug: 'e2e-create',
                name: 'E2E Created',
                notes: 'test note',
                type: 'client'
            })
        );
        await waitFor(() => {
            expect(locationMock.reload).toHaveBeenCalled();
        });
    });

    it('opens edit modal via design-lab:edit-client event and submits update', async () => {
        const user = userEvent.setup();
        mockedApi.fetchClients.mockResolvedValue([
            {
                schema_version: 2,
                slug: '_personal',
                name: 'Original Name',
                type: 'self',
                created_at: '2026-01-01T00:00:00Z',
                notes: '',
                theme_color: '#1F2937'
            }
        ]);
        mockedApi.updateClient.mockResolvedValue({ slug: '_personal' });

        render(<ClientCrudForm />);

        window.dispatchEvent(
            new CustomEvent('design-lab:edit-client', { detail: { slug: '_personal' } })
        );

        const heading = await screen.findByRole('heading', { name: 'Edit _personal' });
        expect(heading).toBeInTheDocument();

        const nameInput = screen.getByLabelText('Name') as HTMLInputElement;
        expect(nameInput.value).toBe('Original Name');

        await user.clear(nameInput);
        await user.type(nameInput, 'E2E Updated');

        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(mockedApi.updateClient).toHaveBeenCalledTimes(1);
        });
        expect(mockedApi.updateClient).toHaveBeenCalledWith(
            '_personal',
            expect.objectContaining({ name: 'E2E Updated' })
        );
        await waitFor(() => {
            expect(locationMock.reload).toHaveBeenCalled();
        });
    });

    it('archives client via design-lab:archive-client event when confirmed', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        mockedApi.archiveClient.mockResolvedValue({ slug: '_personal', archivePath: '/x' });

        render(<ClientCrudForm />);

        window.dispatchEvent(
            new CustomEvent('design-lab:archive-client', { detail: { slug: '_personal' } })
        );

        await waitFor(() => {
            expect(confirmSpy).toHaveBeenCalled();
        });
        await waitFor(() => {
            expect(mockedApi.archiveClient).toHaveBeenCalledWith('_personal');
        });
        await waitFor(() => {
            expect(locationMock.reload).toHaveBeenCalled();
        });
    });

    it('skips archive when user cancels confirm dialog', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(false);

        render(<ClientCrudForm />);

        window.dispatchEvent(
            new CustomEvent('design-lab:archive-client', { detail: { slug: '_personal' } })
        );

        // Wait a tick for handler to settle
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(mockedApi.archiveClient).not.toHaveBeenCalled();
        expect(locationMock.reload).not.toHaveBeenCalled();
    });
});
