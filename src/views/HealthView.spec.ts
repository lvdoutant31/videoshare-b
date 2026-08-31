import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import HealthView from './HealthView.vue';

describe('HealthView', () => {
  it('shows the service after a successful health check', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 'OK',
      data: { service: 'admin-api', status: 'UP' }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    const wrapper = mount(HealthView);
    await wrapper.get('button').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('admin-api 已就绪');
  });
});
