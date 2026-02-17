import React, { useState } from 'react';
import { Panel, Badge, TextInput, InputGroup, SelectInput } from '../ui/LayoutComponents';
import { Drawer } from '../ui/Drawer';
import { UserProfile } from '../../types';
import { Search, Plus, Edit, Trash2, Users, Shield, Lock, Unlock, Mail, Calendar, Circle } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';

interface Props {
    users: UserProfile[];
    setUsers: React.Dispatch<React.SetStateAction<UserProfile[]>>;
}

const UserManagement: React.FC<Props> = ({ users, setUsers }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isDrawerOpen, setDrawerOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<Partial<UserProfile> | null>(null);
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

    React.useEffect(() => {
        const channel = supabase.channel('online-users');
        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const ids = Object.values(state).flat().map((p: any) => p.id);
                setOnlineUsers(ids);
            })
            .subscribe();

        return () => { channel.unsubscribe(); };
    }, []);

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.role.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAddNew = () => {
        setEditingUser({
            id: `USR-${Math.floor(Math.random() * 10000)}`,
            name: '',
            email: '',
            role: 'Trader',
            status: 'Active',
            department: '',
            lastLogin: 'Never'
        });
        setDrawerOpen(true);
    };

    const handleEdit = (user: UserProfile) => {
        setEditingUser({ ...user });
        setDrawerOpen(true);
    };

    const handleSave = () => {
        if (editingUser && editingUser.id && editingUser.name) {
            const exists = users.find(u => u.id === editingUser.id);
            if (exists) {
                setUsers(users.map(u => u.id === editingUser.id ? editingUser as UserProfile : u));
            } else {
                setUsers([...users, editingUser as UserProfile]);
            }
            setDrawerOpen(false);
        }
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Are you sure you want to remove this user?')) {
            setUsers(users.filter(u => u.id !== id));
        }
    };

    return (
        <Panel title="User Access Management" className="h-full">
            <div className="flex flex-col h-full">

                {/* Toolbar */}
                <div className="p-4 border-b border-slate-700 bg-slate-900 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search users..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-slate-950 border border-slate-700 rounded pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 w-64"
                            />
                        </div>
                        <div className="text-xs text-slate-500">
                            <strong>{filteredUsers.length}</strong> registered users
                        </div>
                    </div>
                    <button
                        onClick={handleAddNew}
                        className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600 text-white rounded border border-cyan-500 text-xs hover:bg-cyan-500 font-bold shadow-lg shadow-cyan-900/20"
                    >
                        <Plus size={12} /> Add User
                    </button>
                </div>

                {/* User Grid */}
                <div className="flex-1 overflow-auto bg-slate-900 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredUsers.map(user => (
                            <div key={user.id} className="bg-slate-950 border border-slate-800 rounded-lg p-4 group hover:border-slate-600 transition-colors relative">

                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEdit(user)} className="text-slate-400 hover:text-cyan-400"><Edit size={14} /></button>
                                    <button onClick={() => handleDelete(user.id)} className="text-slate-400 hover:text-red-400"><Trash2 size={14} /></button>
                                </div>

                                <div className="flex items-start gap-3 mb-4">
                                    <div className="relative">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border 
                                    ${user.role === 'Admin' ? 'bg-purple-900/20 text-purple-400 border-purple-800' :
                                                user.role === 'Risk_Manager' ? 'bg-red-900/20 text-red-400 border-red-800' :
                                                    user.role === 'Auditor' ? 'bg-amber-900/20 text-amber-400 border-amber-800' :
                                                        'bg-slate-800 text-cyan-400 border-slate-700'}`}>
                                            {user.name.charAt(0)}{user.name.split(' ')[1]?.charAt(0)}
                                        </div>
                                        {onlineUsers.includes(user.id) && (
                                            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-950 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-sm font-bold text-slate-200">{user.name}</h4>
                                            {onlineUsers.includes(user.id) && (
                                                <span className="bg-emerald-500/10 text-emerald-500 text-[8px] px-1.5 py-0.5 rounded-full font-bold tracking-wider border border-emerald-500/20 uppercase">Online</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                            <Mail size={10} /> {user.email}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2 border-t border-slate-900 pt-3">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500">Role</span>
                                        <Badge variant="default">{user.role.replace('_', ' ')}</Badge>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500">Department</span>
                                        <span className="text-slate-300">{user.department}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500">Status</span>
                                        <div className="flex items-center gap-1">
                                            {user.status === 'Active' ? <Unlock size={10} className="text-emerald-500" /> : <Lock size={10} className="text-red-500" />}
                                            <span className={user.status === 'Active' ? 'text-emerald-400' : 'text-red-400'}>{user.status}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-3 pt-2 text-[9px] text-slate-600 font-mono flex items-center gap-1">
                                    <Calendar size={10} /> Last Login: {user.lastLogin === 'Never' ? 'Never' : new Date(user.lastLogin).toLocaleString()}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Edit/Add Drawer */}
            <Drawer
                isOpen={isDrawerOpen}
                onClose={() => setDrawerOpen(false)}
                title={editingUser?.id ? "Edit User Profile" : "Create New User"}
                footer={
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setDrawerOpen(false)} className="px-4 py-2 text-xs text-slate-400 hover:text-white">Cancel</button>
                        <button onClick={handleSave} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded">Save Profile</button>
                    </div>
                }
            >
                {editingUser && (
                    <div className="space-y-6">
                        <div className="p-4 bg-slate-900 rounded border border-slate-800 flex items-center gap-3">
                            <Shield size={24} className="text-slate-500" />
                            <div>
                                <h4 className="text-xs font-bold text-slate-300">Security Credentials</h4>
                                <p className="text-[10px] text-slate-500">Manage access level and profile details.</p>
                            </div>
                        </div>

                        <InputGroup label="Full Name">
                            <TextInput
                                value={editingUser.name}
                                onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                                placeholder="e.g. John Doe"
                            />
                        </InputGroup>

                        <InputGroup label="Email Address">
                            <TextInput
                                value={editingUser.email}
                                onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                                placeholder="john.doe@nexus.bank"
                            />
                        </InputGroup>

                        <div className="grid grid-cols-2 gap-4">
                            <InputGroup label="Role">
                                <SelectInput
                                    value={editingUser.role}
                                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                                >
                                    <option value="Admin">Administrator</option>
                                    <option value="Trader">Trader</option>
                                    <option value="Risk_Manager">Risk Manager</option>
                                    <option value="Auditor">Auditor</option>
                                </SelectInput>
                            </InputGroup>
                            <InputGroup label="Status">
                                <SelectInput
                                    value={editingUser.status}
                                    onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value as any })}
                                >
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                    <option value="Locked">Locked</option>
                                </SelectInput>
                            </InputGroup>
                        </div>

                        <InputGroup label="Department">
                            <TextInput
                                value={editingUser.department}
                                onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value })}
                            />
                        </InputGroup>
                    </div>
                )}
            </Drawer>
        </Panel>
    );
};

export default UserManagement;
