/**
 * Copyright 2017 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {assertHttpsUrl} from '../../../src/url';
import {isLayoutSizeDefined} from '../../../src/layout';
import {removeElement} from '../../../src/dom';

export class AmpGoogleDoc extends AMP.BaseElement {

  /** @param {!AmpElement} element */
  constructor(element) {
    super(element);

    /** @private @const {string} */
    this.src_ = null;
    /** @private {?HTMLIFrameElement} */
    this.iframe_ = null;
  }

  /** @override */
  renderOutsideViewport() {
    // We are conservative about loading heavy embeds.
    // This will still start loading before they become visible, but it
    // won't typically load a large number of embeds.
    return 0.75;
  }

  /** @override */
  buildCallback() {
    this.src_ = assertHttpsUrl(this.element.getAttribute('src'), this.element);
  }

  /**
   * @param {boolean=} opt_onLayout
   * @override
   */
  preconnectCallback(opt_onLayout) {
    if (this.src_) {
      this.preconnect.url(this.src_, opt_onLayout);
    }
  }

  /** @override */
  isLayoutSupported(layout) {
    return isLayoutSizeDefined(layout);
  }

  /** @override */
  layoutCallback() {
    const iframe = this.element.ownerDocument.createElement('iframe');
    iframe.onload = () => {
      // Chrome does not reflect the iframe readystate.
      iframe.readyState = 'complete';
    };
    this.applyFillContent(iframe);
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.setAttribute('src', this.src_);
    this.element.appendChild(iframe);

    this.iframe_ = iframe;

    return this.loadPromise(iframe);
  }

  /** @override */
  unlayoutOnPause() {
    return true;
  }

  /** @override */
  unlayoutCallback() {
    if (this.iframe_) {
      removeElement(this.iframe_);
      this.iframe_ = null;
    }
    return true;
  }
}

AMP.registerElement('amp-google-doc', AmpGoogleDoc);
