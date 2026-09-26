import assert from 'node:assert/strict';
import test from 'node:test';
import { campaignStatusAfterCeoReviews, campaignStatusAfterFinalApprovals, isReadyForChannelQueue, managerPathForContentChannel } from '../lib/content-routing.ts';

test('approved destinations route only to their own separate manager page', () => {
  assert.equal(managerPathForContentChannel('paid_ads'), '/admin/ads');
  assert.equal(managerPathForContentChannel('social'), '/admin/social-manager');
  assert.equal(isReadyForChannelQueue({ status: 'admin_approved', channel_type: 'social' }, 'social'), true);
  assert.equal(isReadyForChannelQueue({ status: 'admin_approved', channel_type: 'paid_ads' }, 'social'), false);
  assert.equal(isReadyForChannelQueue({ status: 'approved', channel_type: 'paid_ads' }, 'paid_ads'), false);
});

test('CEO campaign status keeps approved destinations eligible when a sibling is rejected', () => {
  assert.equal(campaignStatusAfterCeoReviews(['approved', 'rejected']), 'approved');
  assert.equal(campaignStatusAfterCeoReviews(['approved', 'pending_review']), 'pending_review');
  assert.equal(campaignStatusAfterCeoReviews(['rejected', 'rejected']), 'rejected');
  assert.equal(campaignStatusAfterCeoReviews(['rejected', 'on_hold']), 'on_hold');
});

test('campaign final status waits for each channel asset decision without blocking approved queue items', () => {
  assert.equal(campaignStatusAfterFinalApprovals(['admin_approved', 'approved']), 'approved');
  assert.equal(campaignStatusAfterFinalApprovals(['admin_approved', 'rejected']), 'admin_approved');
  assert.equal(campaignStatusAfterFinalApprovals(['rejected', 'rejected']), 'rejected');
});
