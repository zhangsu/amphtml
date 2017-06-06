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

import {CSS} from '../../../build/amp-facebook-like-oauth-0.1.css';
import {isLayoutSizeDefined} from '../../../src/layout';
import {assertHttpsUrl, parseQueryString} from '../../../src/url';

export class AmpFacebookLikeOauth extends AMP.BaseElement {
  /** @param {!AmpElement} element */
  constructor(element) {
    super(element);

    /** @private @const {string} The URL to like on Facebook. */
    this.encodedSrc_ = null;

    /**
     * The cached Open Graph object ID of the URL to like on Facebook.
     * @private @const {string}
     */
    this.objectId_ = null;

    /** @private {!Element} */
    this.container_ = this.win.document.createElement('div');

    /** @private {!Element} The like button. */
    this.button_ = this.win.document.createElement('button');
    this.button_.classList.add('like-button');

    /** @private {!Element} The like count displayed in the button text. */
    this.count_ = this.win.document.createElement('div');
    this.count_.classList.add('like-count');
  }

  /** @override */
  buildCallback() {
    this.encodedSrc_ =
        this.win.encodeURIComponent(assertHttpsUrl(this.element.getAttribute('src'), this.element));

    this.button_.textContent = this.element.hasAttribute('button-text') ?
        assertHttpsUrl(this.element.getAttribute('button-text'), this.element) :
        'Like';
    this.container_.appendChild(this.button_);
    this.container_.appendChild(this.count_);
    this.element.appendChild(this.container_);
  }

  /** @override */
  isLayoutSupported(layout) {
    return isLayoutSizeDefined(layout);
  }

  /** @override */
  layoutCallback() {
    const hashParams = parseQueryString(this.win.location.hash.substring(1));

    if (hashParams['access_token']) {
      this.persistGrantedAccess_(hashParams['access_token']);
      this.toggleLike_();
    }

    this.button_.addEventListener('click', (e) => {
      if (this.isAccessGranted_()) {
        this.toggleLike_();
      } else {
        this.signIn_();
      }
    });

    if (this.isAccessGranted_()) {
      this.refreshState_();
    }

    this.applyFillContent(this.container_);
    return this.loadPromise(this.container_);
  }

  /** @param {!string} accessToken */
  persistGrantedAccess_(accessToken) {
    this.win.localStorage.setItem('oauth2-fb', accessToken);
  }

  /** @return {boolean} */
  isAccessGranted_() {
    return this.win.localStorage.getItem('oauth2-fb') != null;
  }

  toggleLike_() {
    this.getObjectId_()
        .then(
            (objectId) => this.callApi_(
                `${objectId}/likes?url=${this.encodedSrc_}`,
                this.button_.classList.contains('liked') ? 'DELETE' : 'POST'))
        .then((body) => this.refreshState_());
  }

  /**
   * Updates states like the current like count and whether the user has liked
   * the URL already.
   */
  refreshState_() {
    this.getObjectId_()
        .then((objectId) => this.callApi_(`${objectId}/likes?summary=true`))
        .then((body) => {
          const summary = body['summary'];
          const count = summary['total_count'];
          if (summary['has_liked']) {
            this.button_.classList.add('liked');
            this.count_.textContent = `You and ${count - 1} people like this.`;
          } else {
            this.button_.classList.remove('liked');
            this.count_.textContent = `${count} people like this.`;
          }
        })
        .catch((error) => console.log(error));
  }

  /** @return {Promise<string>} */
  getObjectId_() {
    if (this.objectId_) {
      return Promise.resolve(this.objectId_);
    }

    return this.callApi_(`?id=${this.encodedSrc_}`).then((body) => {
      this.objectId_ = body['og_object']['id'];
      return this.objectId_;
    });
  }

  /**
   * @param {!string} urlSuffix The suffix (after the `/vX.X` part) of the API
   *     URL to call
   * @param {!string=} method The HTTP method to use for the call.
   * @return {!Promise<object>} The JSON object contained in the response.
   */
  callApi_(urlSuffix, method = 'GET') {
    const accessToken = this.win.localStorage.getItem('oauth2-fb');
    return this.win
        .fetch('https://graph.facebook.com/v2.9/' + urlSuffix, {
          method: method,
          headers: new Headers({Authorization: `Bearer ${accessToken}`}),
        })
        .then((response) => response.json())
        .then((body) => {
          if (body['error']) {
            const error = body['error'];
            if (error['type'] == 'OAuthException' && error['code'] == 190) {
              this.signIn_();
            }
            throw new Error(error['message']);
          }
          return body;
        });
  }

  /** Redirects to the OAuth2 implicit flow sign in dialog. */
  signIn_() {
    const form = this.win.document.createElement('form');
    form.setAttribute('method', 'GET');
    form.setAttribute('action', 'https://www.facebook.com/v2.9/dialog/oauth');

    const params = {
      'client_id': '733349513518212',
      'redirect_uri': this.win.location.href,
      'scope': 'publish_actions,user_likes',
      'response_type': 'token'
    };
    for (const p in params) {
      const input = this.win.document.createElement('input');
      input.setAttribute('type', 'hidden');
      input.setAttribute('name', p);
      input.setAttribute('value', params[p]);
      form.appendChild(input);
    }

    this.win.document.body.appendChild(form);
    form.submit();
  }
}

AMP.registerElement('amp-facebook-like-oauth', AmpFacebookLikeOauth, CSS);
