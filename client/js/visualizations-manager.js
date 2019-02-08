Page.class = class VisualizationsManager extends Page {

	constructor() {

		super();

		window.on('popstate', e => this.loadState(e.state));

		this.list = new VisualizationsManagerList(this);

		this.load();

		this.container.appendChild(this.list.container);

		this.container.insertAdjacentHTML('beforeend', `
			<section class"section" id="edit"></section>
		`);

		Sections.show('list');
	}

	async load() {

		await this.loadConnections();
		this.list.setup();
		await this.list.load();
	}

	async loadConnections() {

		this.connections = await API.call('credentials/list')

		const connections = new Map;

		for(const connection of this.connections) {

			for(const feature of MetaData.features.values()) {

				if(feature.slug == connection.type && feature.type == 'source')
					connection.feature = feature;
			}

			if(!connection.feature)
				continue;

			connections.set(connections.id, connection);
		}

		this.connections = new Map(this.connections.map(c => [c.id, c]));
	}
}

class VisualizationsManagerList extends Map {

	constructor(page) {

		super();

		this.page = page;
	}

	setup() {

		const filters = [
			{
				key: 'Query ID',
				rowValue: row => [row.query_id],
			},
			{
				key: 'Name',
				rowValue: row => row.name ? [row.name] : [],
			},
			{
				key: 'Description',
				rowValue: row => row.description ? [row.description] : [],
			},
			{
				key: 'Created By',
				rowValue: row =>  row.added_by_name ? [row.added_by_name] : [],
			},
			{
				key: 'Connection Name',
				rowValue: row => {
					if(page.connections.has(parseInt(row.connection_name)))
						return [page.connections.get(parseInt(row.connection_name)).name];
					else
						return [];
				},
			},
			{
				key: 'Connection Type',
				rowValue: row => {
					if(page.connections.has(parseInt(row.connection_name)))
						return [page.connections.get(parseInt(row.connection_name)).feature.name];
					else
						return [];
				},
			},
			{
				key: 'Filter Length',
				rowValue: row => [row.filters.length]
			},
			{
				key: 'Filter Name',
				rowValue: row => row.filters.map(f => f.name ? f.name : []),
			},
			{
				key: 'Filter Placeholder',
				rowValue: row => row.filters.map(f => f.placeholder ? f.placeholder : []),
			},
			{
				key: 'Visualization ID',
				rowValue: row => row.visualizations.map(f => f.visualization_id ? f.visualization_id : []),
			},
			{
				key: 'Visualization Name',
				rowValue: row => row.visualizations.map(f => f.name ? f.name : []),
			},
			{
				key: 'Visualization Type',
				rowValue: row => {
					return row.visualizations.map(f => f.type)
											   .map(m => MetaData.visualizations.has(m) ?
											   (MetaData.visualizations.get(m)).name : []);
				},
			},
			{
				key: 'Visualization Created By',
				rowValue: row => row.visualizations.map(f => f.added_by_name ? f.added_by_name : []),
			},
			{
				key: 'Visualization Length',
				rowValue: row => [row.visualizations.length],
			},
			{
				key: 'Report Enabled',
				rowValue: row => row.is_enabled ? ['yes'] : ['no'],
			},
			{
				key: 'Report Creation',
				rowValue: row => row.created_at ? [row.created_at] : [],
			},
			{
				key: 'Definition',
				rowValue: row => row.query ? [row.query] : [],
			},
			{
				key: 'Report Refresh Rate',
				rowValue: row => row.refresh_rate ? [row.refresh_rate] : [],
			},
			{
				key: 'Subtitle',
				rowValue: row => {
					if(MetaData.categories.has(parseInt(row.subtitle)))
						return [MetaData.categories.get(parseInt(row.subtitle)).name];
					else
						return [];
				},
			},
			{
				key: 'Report Last Updated At',
				rowValue: row => row.updated_at ? [row.updated_at] : [],
			}
		];

		this.searchBar = new SearchColumnFilters({ filters });

		this.container.querySelector('.section .toolbar').appendChild(this.searchBar.globalSearch.container);

		this.container.querySelector('.section .toolbar').insertAdjacentElement('afterend', this.searchBar.container);

		this.searchBar.on('change', () => this.load(false) );
	}

	get container() {

		if(this.containerElemenet)
			return this.containerElemenet;

		const container = this.containerElemenet = document.createElement('section');

		container.classList.add('section');
		container.id = 'list';

		container.innerHTML = `

			<h1>Visualizations Manager</h1>
			<form class="toolbar form"></form>
			<div class="visualizations"></div>
		`;

		if(0 && this.page.user.privileges.has('visualization.insert')) {

			container.querySelector('.toolbar').insertAdjacentHTML('beforebegin', `
				<button tpe="button"><i class="fas fa-plus"></i> Create New Visualization</button>
			`);

			container.querySelector('.toolbar button').on('click', () => VisualizationsManagerVisualization.add(this.page));
		}

		return container;
	}

	async load(force = true) {

		await this.fetch(force);

		this.process();

		this.render();
	}

	async fetch(force) {
		await DataSource.load(force);
	}

	process() {

		this.searchBar.data = Array.from(DataSource.list.values());

		this.clear();

		const filterData = this.searchBar.filterData;

		for(const report of filterData) {

			for(const visualization of report.visualizations)
				this.set(visualization.visualization_id, new VisualizationManager(visualization, report, this.page));
		}
	}

	render() {

		const list = this.container.querySelector('.visualizations');

		list.textContent = null;

		for(const visualization of this.values()) {

			list.appendChild(visualization.row);
		}
	}
}

class VisualizationManager {

	constructor(visualization, report, page) {

		Object.assign(this, visualization);

		this.report = report;
		this.page = page;

		this.visualization = MetaData.visualizations.get(this.type);

		if(!this.options)
			this.options = {};

		if(typeof this.options != 'string')
			return;

		try {
			this.options = JSON.parse(this.options) || {};
		}

		catch(e) {
			this.options = {};
		}
	}

	get row() {

		if(this.rowElement)
			return this.rowElement;

		const row = this.rowElement = document.createElement('div');

		row.classList.add('visualization');

		row.innerHTML = `
			<img src="${this.visualization.image}">

			<h2>
				<a href="/visualization/${this.visualization_id}" target="_blank">
					${this.name}
				</a>
				<span class="id">#${this.visualization_id}</span>
			</h2>

			<span class="subtitle">

				<span>Type: <strong>${this.visualization.name}</strong></span>

				<span>
					Report:
					<strong>
						<a href="/report/${this.report.query_id}" target="_blank">
							${this.report.name}
						</a>
					</strong>
					<span class="id">#${this.query_id}</span>
				</span>
			</span>

			<div class="actions"></div>
		`;

		if(this.editable) {

			const edit = document.createElement('a');

			edit.textContent = 'Edit';

			edit.on('click', () => window.location = `/reports/configure-visualization/${this.visualization_id}`);

			row.querySelector('.actions').appendChild(edit);
		}

		if(this.deletable) {

			const _delete = document.createElement('a');

			_delete.textContent = 'Delete';

			_delete.on('click', () => this.delete());

			row.querySelector('.actions').appendChild(_delete);
		}

		return row;
	}

	edit() {

		const container = this.page.container.querySelector('section#edit');

		container.textContent = null;

		container.appendChild(this.container);

		Sections.show('edit');
	}

	async delete() {

		if(!confirm('Are you sure?'))
			return;

		const
			parameters = {
				visualization_id: this.visualization_id,
			},
			options = {
				method: 'POST',
			};

		try {

			const response = await API.call('reports/visualizations/delete', parameters, options);

			await this.page.list.load();

			const type = MetaData.visualizations.get(this.type);

			new SnackBar({
				message: `${type ? type.name : ''} Visualization Deleted`,
				subtitle: `${this.name} #${this.visualization_id}`,
				icon: 'far fa-trash-alt',
			});

		} catch(e) {

			new SnackBar({
				message: 'Request Failed',
				subtitle: e.message,
				type: 'error',
			});

			throw e;
		}
	}

	get container() {

		if(this.containerElement) {

			return this.containerElement;
		}

		const container = this.containerElement = document.createElement('div');
		container.classList.add('visualization-form');

		container.innerHTML = `
			<form id="configure-visualization-form">
				<div class="configuration-section">
					<h3><i class="fas fa-angle-right"></i> General</h3>
					<div class="body">
						<div class="form subform">
							<label>
								<span>Name</span>
								<input type="text" name="name" required>
							</label>

							<label>
								<span>Visualization Type</span>
								<select name="type" required></select>
							</label>

							<label>
								<span>Description</span>
								<textarea  name="description" rows="4" cols="50"></textarea>
							</label>
						</div>
					</div>
				</div>

				<div class="options"></div>

			</form>
		`;

		this.form = container.querySelector('#configure-visualization-form');
		this.optionsForm = new (VisualizationManager.types.get(this.type))(this, this.page);

		this.transformations = new ReportTransformations(this, this.page);
		this.reportVisualizationFilters =  new ReportVisualizationFilters(this, this.page);

		container.appendChild(this.transformations.container);
		container.appendChild(this.reportVisualizationFilters.container);

		for(const visualization of MetaData.visualizations.values()) {

			this.form.type.insertAdjacentHTML('beforeend', `
				<option value="${visualization.slug}">${visualization.name}</option>
			`);
		}

		this.form.on('submit', e => this.update(e));

		return container;
	}

	async load() {

		this.form.reset();

		this.form.name.value = this.name;
		this.form.type.value = this.type;
		this.form.description.value = this.description;

		this.reportVisualizationFilters.load();

		this.transformations.load();
		this.container.querySelector('.options').appendChild(this.optionsForm.form);

		this.setupConfigurationSetions();

		const first = this.container.querySelector('.configuration-section');

		if(first && first.querySelector('.body.hidden'))
			first.querySelector('h3').click();
	}

	async update(e) {

		if(e) {

			e.preventDefault();
		}

		const
			parameters = {
				visualization_id: this.visualization_id
			},
			options = {
				method: 'POST',
				form: new FormData(this.form),
			};

		options.form.set('options', JSON.stringify(this.json.options));

		try {

			await API.call('reports/visualizations/update', parameters, options);

			await DataSource.load(true);

			this.page.logs.clear();

			this.list.load();

			const type = MetaData.visualizations.get(this.type);

			new SnackBar({
				message: `${type ? type.name : ''} Visualization Saved`,
				subtitle: `${this.name} #${this.visualization_id}`,
				icon: 'far fa-save',
			});

		} catch(e) {

			new SnackBar({
				message: 'Request Failed',
				subtitle: e.message,
				type: 'error',
			});

			throw e;
		}
	}

	get json() {

		return {
			visualization_id: this.visualization_id,
			query_id: this.query_id,
			type: this.form.type.value,
			name: this.form.name.value,
			description: this.form.description.value,
			options: {
				...this.optionsForm.json,
				transformations: this.transformations.json,
				filters: this.reportVisualizationFilters.json
			}
		};
	}

	async preview() {

		this.stage.page.preview.load({
			query_id: this.query_id,
			visualizationOptions: this.json.options,
			visualization: {
				id: this.visualization_id,
				type: this.json.type,
				name: this.json.name
			}
		});

		new SnackBar({
			message: 'Preview Loaded',
			subtitle: 'Your changes are not saved yet, and will be lost if page is reloaded',
			icon: 'fas fa-eye',
		});
	}

	setupConfigurationSetions(container) {

		if(!container)
			container = this.container;

		for(const section of container.querySelectorAll('.configuration-section')) {

			const
				body = section.querySelector('.body'),
				h3 = section.querySelector('h3');

			body.classList.add('hidden');

			h3.removeEventListener('click', h3.clickListener);

			h3.on('click', h3.clickListener = e => {

				body.classList.toggle('hidden');

				for(const svg of h3.querySelectorAll('.fa-angle-right, .fa-angle-down'))
					svg.remove();

				h3.insertAdjacentHTML('afterbegin', body.classList.contains('hidden') ? '<i class="fas fa-angle-right"></i>' : '<i class="fas fa-angle-down"></i>');
			});
		}
	}
}