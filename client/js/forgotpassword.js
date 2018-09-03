Page.class = class ForgotPassword extends Page {

	constructor() {

		super();

		document.querySelector('body > header').classList.add('hidden');

		this.form = this.container.querySelector('form');
		this.message = this.container.querySelector('#message');

		this.form.on('submit', e => this.submit(e));

		if(!account) {
			this.message.textContent = 'Account not found!';
			this.message.classList.remove('hidden');
			this.message.classList.add('warning');
			return;
		}

		const logo = this.container.querySelector('.logo img');

		logo.on('load', () => logo.parentElement.classList.remove('hidden'));

		logo.src = account.logo;
	}

	async submit(e) {

		e.preventDefault();

		this.message.classList.remove('warning', 'hidden', 'notice');
		this.message.textContent = null;

		const options = {
			method: 'POST',
			form: new FormData(this.form),
		};

		try {

			const response = await API.call('authentication/resetlink', {account_id: this.account.account_id}, options);

			this.message.classList.add('notice');
			this.message.textContent = response;
		}

		catch(error) {

			this.message.classList.add('warning');
			this.message.textContent = error.message || error || 'Something went wrong!';
		}
	}
}