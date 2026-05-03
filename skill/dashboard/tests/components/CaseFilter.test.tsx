import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CaseFilter } from '../../src/components/CaseFilter';
import { locationMock } from '../setup';

const SCENARIOS = ['landing', 'saas-ui', 'brand', 'content'];

beforeEach(() => {
    locationMock.search = '';
});

describe('CaseFilter', () => {
    it('renders all scenarios + sentiment toggle + Apply/Reset buttons', () => {
        render(<CaseFilter scenarios={SCENARIOS} />);

        expect(screen.getByRole('combobox')).toBeInTheDocument();
        for (const label of ['All', 'positive', 'negative']) {
            expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
        }
        expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
    });

    it('applies scenario filter to window.location.search', async () => {
        const user = userEvent.setup();
        render(<CaseFilter scenarios={SCENARIOS} />);

        await user.selectOptions(screen.getByRole('combobox'), 'landing');
        await user.click(screen.getByRole('button', { name: 'Apply' }));

        expect(locationMock.search).toBe('?scenario=landing');
    });

    it('applies sentiment filter to window.location.search', async () => {
        const user = userEvent.setup();
        render(<CaseFilter scenarios={SCENARIOS} />);

        await user.click(screen.getByRole('button', { name: 'positive' }));
        await user.click(screen.getByRole('button', { name: 'Apply' }));

        expect(locationMock.search).toBe('?sentiment=positive');
    });

    it('combines scenario + sentiment in URL', async () => {
        const user = userEvent.setup();
        render(<CaseFilter scenarios={SCENARIOS} />);

        await user.selectOptions(screen.getByRole('combobox'), 'brand');
        await user.click(screen.getByRole('button', { name: 'negative' }));
        await user.click(screen.getByRole('button', { name: 'Apply' }));

        expect(locationMock.search).toBe('?scenario=brand&sentiment=negative');
    });

    it('reset clears window.location.search', async () => {
        const user = userEvent.setup();
        locationMock.search = '?scenario=landing&sentiment=positive';
        render(
            <CaseFilter
                scenarios={SCENARIOS}
                initialScenario="landing"
                initialSentiment="positive"
            />
        );

        await user.click(screen.getByRole('button', { name: 'Reset' }));

        expect(locationMock.search).toBe('');
    });

    it('hydrates initial scenario + sentiment props into form state', () => {
        render(
            <CaseFilter
                scenarios={SCENARIOS}
                initialScenario="saas-ui"
                initialSentiment="negative"
            />
        );

        const select = screen.getByRole('combobox') as HTMLSelectElement;
        expect(select.value).toBe('saas-ui');

        const negativeBtn = screen.getByRole('button', { name: 'negative' });
        expect(negativeBtn.className).toContain('bg-');
    });
});
