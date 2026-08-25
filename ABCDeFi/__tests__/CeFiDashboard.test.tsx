import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { CeFiDashboard } from '../src/Components/CeFiDashboard';

const localStorageMock = (() => {
    let store: Record<string, string> = {};

    return {
        getItem(key: string) {
            return store[key] ?? null;
        },
        setItem(key: string, value: string) {
            store[key] = String(value);
        },
        removeItem(key: string) {
            delete store[key];
        },
        clear() {
            store = {};
        },
    };
})();

describe('CeFiDashboard auth experience', () => {
    beforeEach(() => {
        localStorageMock.clear();
        Object.defineProperty(global, 'localStorage', {
            value: localStorageMock,
            writable: true,
        });
    });

    it('shows a signed-in account view after a successful sign in', async () => {
        let testRenderer: renderer.ReactTestRenderer;

        await act(async () => {
            testRenderer = renderer.create(<CeFiDashboard />);
        });

        const root = testRenderer!.root;
        const emailInput = root.findByProps({ type: 'email' });
        const passwordInput = root.findByProps({ type: 'password' });

        await act(async () => {
            emailInput.props.onChange({ target: { value: 'alex.trader@abcdefi.io' } });
            passwordInput.props.onChange({ target: { value: '••••••••••••' } });
            root.findByType('form').props.onSubmit({ preventDefault() { } });
            await new Promise((resolve) => setTimeout(resolve, 800));
        });

        const tree = testRenderer!.toJSON();
        const output = JSON.stringify(tree);

        expect(output).toContain('Signed In');
        expect(output).toContain('Alex Rivers');
    });
});
