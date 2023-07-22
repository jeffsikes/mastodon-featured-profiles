/* global Vue */ // for eslint
/* global Mastodon */ // for eslint

var app = Vue.createApp({
    el: '#app',
    data() {
        return {
            server: "",
            servers: [],
            mastodon: undefined,
            my_account: [],
            my_endorsements: [],
            my_followed: [],
            user_id: undefined,
            loading_followed: true,
            loading_endorsed: true,
            total_followed_loaded: 0,
            total_endorsed_loaded: 0,
            followed_search: "",
        }
    },

    async mounted() {
        this.mastodon = await Mastodon.initialize({
            app_name: 'Featured Profiles Lab (Read+Write)',
            app_url: 'https://featured-profiles.netlify.app/',
            // best docs for scopes is here: https://github.com/mastodon/mastodon/pull/7929
            scopes: 'read:accounts write:accounts read:follows',
        });

        if (!this.mastodon.loggedIn()) {
            console.log('not logged in');
            if (localStorage.mastodon_servers != null) {
                this.servers = JSON.parse(localStorage.mastodon_servers);
            }
            else {
                this.servers = await this.get_servers();
            }
            return;
        }

        servers = [];

        this.loading_followed = true;

        this.user_id = await this.get_user_id();

        this.my_account = await this.get_account(this.user_id);

        const [account, endorsements1, followed] = await Promise.all([this.get_account(this.user_id), this.get_account_endorsements(), this.get_followed(this.user_id)]);

        this.my_account = account;
        this.my_endorsements = endorsements1;
        this.my_followed = followed;

    //    this.my_account = await this.get_account(this.user_id);
    //    this.my_endorsements = await this.get_account_endorsements();
    //    this.my_followed = await this.get_followed(this.user_id);

        const endorsements = this.my_endorsements;
        const endorsements_ids = endorsements.map(item => item.id);

        this.my_followed.forEach((item, index) => {
            if (endorsements_ids.includes(item.id)) {
                this.my_followed.splice(index, 1);
            }
        });        

        console.log('my_account', this.my_account);
        console.log('my_endorsements', this.my_endorsements);
        console.log('my_followed', this.my_followed);

        this.loading_followed = false;
},

    watch: {
        name(newFollowed) {
            localStorage.my_followed = newFollowed;
        }
    },

    methods: {
        logout() {
            this.mastodon.logout();
            localStorage.clear();
            window.location.hash = "";
            window.location.reload();
        },

        async set_spinner(toggle) {
            const progressBar = document.getElementById("progress-bar");

            const statusAttribute = progressBar.getAttribute("aria-busy");

            if (progressBar && statusAttribute != toggle) {
                progressBar.setAttribute("aria-busy", toggle);
                progressBar.style.display = toggle ? "block" : "none";

                this.current_progress_bar_visibility = toggle;
            }
        },

        async get_servers() {
            const response = await this.mastodon.get_servers();
            if (!response.ok) {
                alert('error getting servers');
            }
            const data = await response.json();
            console.log('servers: ', data.data);
            return data.data;
        },

        async get_user_id() {
            if (this.user_id &&  this.user_id.length > 0) {
                return this.user_id;
            }
            else {
                const response = await this.mastodon.get('/api/v1/accounts/verify_credentials');
                if (!response.ok) {
                    alert('error getting user id');
                }
                const data = await response.json();
                return data.id;
            }
        },

        async get_account(userId) {
            if (localStorage.my_account && localStorage.my_account.length > 0) {
                return JSON.parse(localStorage.my_account);
            }
            else {
                const response = await this.mastodon.get(`/api/v1/accounts/${userId}`);
                if (!response.ok) {
                    alert('error getting user account');
                }
                const data = await response.json();

                localStorage.my_account = JSON.stringify(data);
                console.log('account data: ', data);
                return data;
            }
        },

        async get_account_endorsements(forceRefresh = false) {
            if (forceRefresh == false && localStorage.my_endorsements && localStorage.my_endorsements.length > 0) {
                data = JSON.parse(localStorage.my_endorsements);
            }
            else {
                this.$root.loading_endorsed = true;

                const response = await this.mastodon.get('/api/v1/endorsements?limit=4');
                var data = [];
                if (!response.ok) {
                    alert('error getting account endorsements');
                }
                else {
                    data = await response.json();
    
                    if (this.parse_link_header(response.headers.get('link'))) {
                        let next = this.parse_link_header(response.headers.get('link'));
                        while (next) {
                            const response = await this.mastodon.get(next);
                            const newData = await response.json();
                            data.push(...newData);
                            next = this.parse_link_header(response.headers.get('link'));
                            this.$root.total_endorsed_loaded = data.length;
                        }
                    }
                }
            }


            console.log('get account endorsements: ', data);

            this.$root.loading_endorsed = false;

            this.$root.total_endorsed_loaded = data.length;

            this.$root.my_endorsements = data;
            
            localStorage.my_endorsements = JSON.stringify(data);

            return data;

        },

        async get_followers(userId, forceRefresh = false) {
            if (forceRefresh == false && localStorage.my_followers && localStorage.my_followers.length > 0) {
                data = localStorage.my_followers;
            }
            else {
                const response = await this.mastodon.get(`/api/v1/accounts/${userId}/followers`);
                if (!response.ok) {
                    alert('error getting account following');
                }
                const data = await response.json();
                console.log('account following: ', data);
            }

            return data;
        },

        async get_followed(userId, forceRefresh = false) {

            if (forceRefresh == false && localStorage.my_followed && localStorage.my_followed.length > 0) {
                data = JSON.parse(localStorage.my_followed);
            }
            else {
                this.$root.loading_followed = true;

                const response = await this.mastodon.get(`/api/v1/accounts/${userId}/following?limit=80`);
                var data = [];
                if (!response.ok) {
                    alert('error getting followed accounts');
                }
                else {
                    data = await response.json();
    
                    this.$root.total_followed_loaded = data.length;

                    if (this.parse_link_header(response.headers.get('link'))) {
                        let next = this.parse_link_header(response.headers.get('link'));
                        while (next) {
                            const response = await this.mastodon.get(next);
                            const newData = await response.json();
                            data.push(...newData);
                            next = this.parse_link_header(response.headers.get('link'));
                            this.$root.total_followed_loaded = data.length;
                        }
                    }
    
                    // Remove the accounts that are already endorsed
                    var endorsements = await this.get_account_endorsements();
                    console.log('endorsements', endorsements);
                    if (endorsements && endorsements.length == 0) {
                        endorsements = await this.get_account_endorsements();
                    }
                    const endorsements_ids = endorsements.map(item => item.id);
                    data.forEach((item, index) => {
                        if (endorsements_ids.includes(item.id)) {
                            data.splice(index, 1);
                        }
                    });
    
                }
            }

            this.$root.loading_followed = false;
            this.$root.total_followed_loaded = data.length;
            localStorage.my_followed = JSON.stringify(data);

            return data;
        },

        async set_account_endorsement(userId) {
            const response = await this.mastodon.post(`/api/v1/accounts/${userId}/pin`);
            if (!response.ok) {
                alert('error setting account endorsement');
            }
            const data = await response.json();
            console.log('set account endorsements: ', data);
            return data;
        },

        async remove_account_endorsement(userId) {
            const response = await this.mastodon.post(`/api/v1/accounts/${userId}:/unpin`);
            if (!response.ok) {
                alert('error removing account endorsement');
            }
            const data = await response.json();
            console.log('remove account endorsement: ', data);
            return data;
        },

        parse_link_header(link) {
            if (!link) {
                return null;
            }
            const links = link.split(',');
            const next = links.find(link => link.includes('rel="next"'));
            if (!next) {
                return null;
            }
            const url = next.match(/<(.*)>/)[1];
            return url;
        },

        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },

        login: async function() {
            const server = this.server;
            if (server == "") {
                alert("Please enter a server address");
                return;
            }

            await this.mastodon.login("https://" + server);
        },


    }
})


app.component('account', {
    props: ['profile', 'endorsements', 'followed', 'loading_followed'],
    template: '#account-template',
}),

app.component('endorsements', {
    props: ['endorsements'],
    template: '#endorsements-template',
    methods: {
        unpin(id) {
            const index = this.endorsements.findIndex(item => item.id === id);
            this.$root.remove_account_endorsement(this.endorsements[index].id);
            // add the item to the followed list
            if (this.$root.my_followed.findIndex(item => item.id === id) == -1) {
                this.$root.my_followed.unshift(this.endorsements[index]);
            }
            // remove the indexed item from this.endorsements
            this.endorsements.splice(index, 1);
        },
    }
}),

app.component('followed', {
    template: '#followed-template',
    data() {
        return {
            searchValue: '',
        }
    },
    props: {
        followed: {
            type: Array,
            required: true
        },
        loading_followed: {
            type: Boolean,
            required: true
        },
        total_followed_loaded: {
            type: Number,
            required: true
        },
    },
    watch: {
        total_followed_loaded(newCount) {
            return newCount;
        },
        followed(newFollowed) {
            return newFollowed;
        },
    },
    computed: {
        filteredFollowed() {
            let tempFollowed = [];

            if (this.searchValue && this.searchValue.length >= 2) {
                tempFollowed = this.followed.filter((item) => {
                    return item.display_name.toLowerCase().includes(this.searchValue.toLowerCase()) || item.acct.toLowerCase().includes(this.searchValue.toLowerCase());
                });
            }

            console.log('tempFollowed', tempFollowed);

            return tempFollowed;
        },
        followedCount() {
            this
        }
    },
    methods: {
        pin(id) {
            console.log('pin', id );
            const index = this.followed.findIndex(item => item.id === id);
            // add the item to the followed list
            this.$root.set_account_endorsement(this.followed[index].id);
            this.$root.my_endorsements.push(this.followed[index]);
            // remove the indexed item from this.followed
            this.followed.splice(index, 1);
        },
        refresh() {
            this.$root.total_followed_loaded = 0;
            this.$root.loading_followed = true;
            this.followed = this.$root.get_followed(this.$root.user_id, true);
            this.$root.loading_followed = true;
        },
    }
}),

app.mount('#app')

