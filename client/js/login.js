/**
 * Handles user login and account selection in face of ambiguity.
 *
 * The login flow is made up of a few stages.
 *
 * 1. Skip user login if the account's auth is overridden.
 * - or -
 * 1. Get the user's email.
 * 2. Let the user pick an account if they are registered in multiple accounts on same domain.
 * 3. Get the user's password and finally send for authentication.
 */
Page.class = class Login extends Page {

	/**
	 * Load the account's logo, set up submit and back listeners and initialize the login bypass.
	 */
	constructor() {

		super();

		if(!this.account)
			return this.message('Account not found! :(', 'warning');

		document.querySelector('body > header').classList.add('hidden');

		const logo = this.container.querySelector('.logo img');

		logo.on('load', () => logo.parentElement.classList.remove('hidden'));
		logo.src = this.account.logo;

		this.container.querySelector('#accept-email form').on('submit', e => {
			e.preventDefault();
			this.loadAccounts();
		});

		this.container.querySelector('#password-back').on('click', () => {
			Sections.show('accept-email');
			this.message('');
		});

		this.bypassLogin();
	}

	/**
	 * Bypass the user login in case the account overrides the auth via settings.
	 */
	async bypassLogin() {

		if(!this.account.auth_api || !(await IndexedDb.instance.get('external_parameters')))
			return this.acceptEmail();

		Sections.show('loading');

		const
			GETParameters = new URLSearchParams(window.location.search),
			parameters = {},
			options = {
				method: 'POST',
			};

		await this.authenticate(parameters, options);
	}

	/**
	 * Load the email form.
	 * This only happens if the user wasn't already logged in automatically with the auth bypass.
	 */
	async acceptEmail() {

		await Sections.show('accept-email');

		this.container.querySelector('#accept-email input').focus();
	}

	/**
	 * Renders the account list in case the user's email is
	 * associated with multiple accounts on same host.
	 * The user is then asked to pick an account which they wish to log in with.
	 */
	async loadAccounts() {

		this.message('');
		Sections.show('loading');

		const
			parameters = {},
			options = {
				method: 'POST',
				form: new FormData(this.container.querySelector('#accept-email form')),
			};

		let accounts;

		try {
			accounts = await API.call('authentication/login', parameters, options);
		} catch(error) {

			this.message(error.message || error, 'warning');

			await Sections.show('accept-email');
			this.container.querySelector('#accept-email input').focus();

			return;
		}

		if(!Array.isArray(accounts))
			throw new Page.exception('Invalid account list! :(');

		const container = this.container.querySelector('#accept-account');

		container.textContent = null;

		for(const account of accounts) {

			const item = document.createElement('div');

			item.classList.add('account');
			item.innerHTML = `<img src="${account.logo}"><span>${account.name}</span>`;

			item.on('click', () => this.acceptPassword(account));

			container.appendChild(item);
		}

		if(!accounts.length)
			container.innerHTML = `<div class="NA">Email not associated with any account! :(</div>`;

		if(accounts.length == 1)
			container.querySelector('.account').click();

		else Sections.show('accept-account');
	}

	/**
	 * Once the user's email and account are established,
	 * we can finally ask for their password.
	 * The account's logo is also shown as well.
	 */
	async acceptPassword(account) {

		Sections.show('accept-password');

		const logo = this.container.querySelector('.logo img');

		logo.parentElement.classList.add('hidden');
		logo.on('load', () => logo.parentElement.classList.remove('hidden'));
		logo.src = account.logo;

		const form = this.container.querySelector('#accept-password form');

		form.reset();
		form.email.value = this.container.querySelector('#accept-email input').value;
		form.password.focus();

		form.removeEventListener('submit', this.acceptPasswordListener);

		form.on('submit', this.acceptPasswordListener = e => {
			e.preventDefault();
			this.login(account);
		});
	}

	/**
	 * Once the user has submited their password we can send for authentication.
	 *
	 * @param object	account	The account that the user chose in the previous step.
	 */
	async login(account) {

		Sections.show('loading');
		this.message('Logging you in!', 'notice');

		const
			parameters = {
				email: this.container.querySelector('#accept-email input').value,
				password: this.container.querySelector('#accept-password input[type=password]').value,
				account_id: account.account_id,
			},
			options = {
				method: 'POST',
			};

		this.authenticate(parameters, options);

		Sections.show('accept-password');
	}

	/**
	 * Authenticate the user with given parameters, do some prep work
	 * if login was successful and take the user to the homepage.
	 *
	 * @param options	parameters	The paramters that need to be sent for validation.
	 * @param options	options		The API call's options.
	 */
	async authenticate(parameters, options) {

		try {

			if(Array.isArray(this.account.settings.get('external_parameters')) && await IndexedDb.instance.get('external_parameters')) {

				const external_parameters = await IndexedDb.instance.get('external_parameters');

				for(const key of this.account.settings.get('external_parameters')) {

					if(key in external_parameters)
						parameters['ext_' + key] = external_parameters[key];
				}
			}

			const response = await API.call('authentication/login', parameters, options);


			if(!response.jwt && response.length)
				return this.message('Ambigious email! :(', 'warning');

			await IndexedDb.instance.set('refresh_token', response.jwt);
			this.cookies.set('refresh_token', response.jwt);

			IndexedDb.instance.delete('account');

			await Account.load();

			// This is done to load the user's information
			await API.refreshToken();

			this.message('Login Successful! Redirecting&hellip;', 'notice');


			window.location = '../';

		} catch(error) {
			this.message(error.message || error, 'warning');
		}
	}

	/**
	 * Shows the user a message with given body and type.
	 * If no body is passed, the message container is hidden.
	 *
	 * @param string	body	The message body.
	 * @param string	type	The type of the message (notice, warning, nothing)
	 */
	message(body, type = '') {

		const container = this.container.querySelector('#message');

		container.innerHTML = body;
		container.classList.remove('warning', 'notice', 'hidden');

		if(type)
			container.classList.add(type);

		container.classList.toggle('hidden', !body);
	}
}