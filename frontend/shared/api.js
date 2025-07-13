// API Module
// frontend/shared/api.js

const ApiModule = {
    // Get API base URL (assumes AuthModule is loaded)
    getBaseUrl() {
        return window.AuthModule ? window.AuthModule.getApiBaseUrl() : 'http://127.0.0.1:8000/api';
    },

    // Make authenticated API request
    async request(endpoint, options = {}) {
        const url = `${this.getBaseUrl()}${endpoint}`;
        const headers = window.AuthModule ? window.AuthModule.getAuthHeaders() : {
            'Content-Type': 'application/json'
        };

        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...headers,
                    ...options.headers
                }
            });

            // Handle 401 (unauthorized) by trying to refresh token
            if (response.status === 401 && window.AuthModule) {
                const refreshResult = await window.AuthModule.refreshToken();
                if (refreshResult.success) {
                    // Retry the original request with new token
                    const newHeaders = window.AuthModule.getAuthHeaders();
                    const retryResponse = await fetch(url, {
                        ...options,
                        headers: {
                            ...newHeaders,
                            ...options.headers
                        }
                    });
                    
                    if (retryResponse.ok) {
                        return await retryResponse.json();
                    }
                }
                
                // If refresh failed or retry failed, redirect to login
                if (window.AuthModule) {
                    window.AuthModule.logout();
                }
                throw new Error('Authentication failed');
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    },

    // Specific API endpoints
    async getClasses() {
        const data = await this.request('/classes/');
        return data.results || data; // Handle paginated response
    },

    async getStudents() {
        const data = await this.request('/students/');
        return data.results || data; // Handle paginated response
    },

    async getLayouts() {
        try {
            const data = await this.request('/layouts/');
            return data.results || data; // Handle paginated response
        } catch (error) {
            console.warn('Layouts API not available:', error);
            return []; // Return empty array if layouts endpoint doesn't exist
        }
    },

    async getSeatingPeriods() {
        try {
            const data = await this.request('/seating-periods/');
            return data.results || data;
        } catch (error) {
            console.warn('Seating periods API not available:', error);
            return [];
        }
    },

    async getSeatingAssignments() {
        try {
            const data = await this.request('/seating-assignments/');
            return data.results || data;
        } catch (error) {
            console.warn('Seating assignments API not available:', error);
            return [];
        }
    },

    async getRoster() {
        try {
            const data = await this.request('/roster/');
            return data.results || data;
        } catch (error) {
            console.warn('Roster API not available:', error);
            return [];
        }
    },

    // Fetch all data needed for the application
    async fetchAllData() {
        console.log('=== Fetching all application data ===');
        
        try {
            // Fetch core data (classes and students are required)
            const [classes, students] = await Promise.all([
                this.getClasses(),
                this.getStudents()
            ]);

            // Fetch optional data (don't fail if these don't exist)
            const [layouts, periods, assignments, roster] = await Promise.all([
                this.getLayouts(),
                this.getSeatingPeriods(), 
                this.getSeatingAssignments(),
                this.getRoster()
            ]);

            const data = {
                classes,
                students,
                layouts,
                periods,
                assignments,
                roster
            };

            console.log('Fetched application data:', {
                classes: Array.isArray(classes) ? classes.length : 'not array',
                students: Array.isArray(students) ? students.length : 'not array',
                layouts: Array.isArray(layouts) ? layouts.length : 'not array',
                periods: Array.isArray(periods) ? periods.length : 'not array',
                assignments: Array.isArray(assignments) ? assignments.length : 'not array',
                roster: Array.isArray(roster) ? roster.length : 'not array'
            });

            return data;
        } catch (error) {
            console.error('Error fetching application data:', error);
            throw error;
        }
    },

    // Create/Update/Delete methods (for future use)
    async createStudent(studentData) {
        return await this.request('/students/', {
            method: 'POST',
            body: JSON.stringify(studentData)
        });
    },

    async updateStudent(studentId, studentData) {
        return await this.request(`/students/${studentId}/`, {
            method: 'PATCH',
            body: JSON.stringify(studentData)
        });
    },

    async deleteStudent(studentId) {
        return await this.request(`/students/${studentId}/`, {
            method: 'DELETE'
        });
    },

    // Classes-specific methods
    async getSeatingChart(classId) {
        return await this.request(`/classes/${classId}/seating_chart/`);
    }
};

// Make API module available globally
if (typeof window !== 'undefined') {
    window.ApiModule = ApiModule;
}