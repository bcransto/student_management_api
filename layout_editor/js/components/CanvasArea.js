// components/CanvasArea.js - Canvas Area Component
const CanvasArea = ({ layout, setLayout, selectedTool, showGrid, selectedItem, setSelectedItem }) => {
    const canvasRef = useRef(null);
    const [draggedItem, setDraggedItem] = useState(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const handleCanvasClick = (e) => {
        // Don't create new items if we're in the middle of a drag
        if (draggedItem) return;
        
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const gridX = Math.floor(x / GRID_SIZE);
        const gridY = Math.floor(y / GRID_SIZE);

        if (selectedTool === TOOL_MODES.TABLE) {
            const newTable = {
                id: Date.now(),
                table_number: layout.tables.length + 1,
                table_name: `Table ${layout.tables.length + 1}`,
                x_position: Math.max(0, Math.min(gridX, layout.room_width - DEFAULT_TABLE.width)),
                y_position: Math.max(0, Math.min(gridY, layout.room_height - DEFAULT_TABLE.height)),
                width: DEFAULT_TABLE.width,
                height: DEFAULT_TABLE.height,
                max_seats: DEFAULT_TABLE.max_seats,
                table_shape: DEFAULT_TABLE.table_shape,
                rotation: DEFAULT_TABLE.rotation,
                seats: generateSeats(DEFAULT_TABLE.table_shape, DEFAULT_TABLE.max_seats, DEFAULT_TABLE.width, DEFAULT_TABLE.height)
            };
            
            setLayout(prev => ({
                ...prev,
                tables: [...prev.tables, newTable]
            }));
            setSelectedItem({ type: 'table', item: newTable });
        } else if (selectedTool === TOOL_MODES.OBSTACLE) {
            const obstacleType = OBSTACLE_TYPES[0];
            const newObstacle = {
                id: Date.now(),
                name: obstacleType.name,
                obstacle_type: obstacleType.id,
                x_position: Math.max(0, Math.min(gridX, layout.room_width - DEFAULT_OBSTACLE.width)),
                y_position: Math.max(0, Math.min(gridY, layout.room_height - DEFAULT_OBSTACLE.height)),
                width: DEFAULT_OBSTACLE.width,
                height: DEFAULT_OBSTACLE.height,
                color: obstacleType.color
            };
            
            setLayout(prev => ({
                ...prev,
                obstacles: [...prev.obstacles, newObstacle]
            }));
            setSelectedItem({ type: 'obstacle', item: newObstacle });
        } else if (selectedTool === TOOL_MODES.SELECT) {
            // Clear selection if clicking on empty space
            setSelectedItem(null);
        }
    };

    const handleItemMouseDown = (e, item, type) => {
        if (selectedTool !== TOOL_MODES.SELECT) return;
        
        e.stopPropagation();
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const itemX = item.x_position * GRID_SIZE;
        const itemY = item.y_position * GRID_SIZE;
        
        setDraggedItem({ item, type });
        setDragOffset({
            x: mouseX - itemX,
            y: mouseY - itemY
        });
        setSelectedItem({ item, type });
    };

    const handleMouseMove = (e) => {
        if (!draggedItem || selectedTool !== TOOL_MODES.SELECT) return;
        
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Calculate new position
        const newX = mouseX - dragOffset.x;
        const newY = mouseY - dragOffset.y;
        
        // Convert to grid coordinates
        const gridX = Math.round(newX / GRID_SIZE);
        const gridY = Math.round(newY / GRID_SIZE);
        
        // Constrain to room bounds
        const constrainedX = Math.max(0, Math.min(gridX, layout.room_width - draggedItem.item.width));
        const constrainedY = Math.max(0, Math.min(gridY, layout.room_height - draggedItem.item.height));
        
        // Update the item position
        if (draggedItem.type === 'table') {
            setLayout(prev => ({
                ...prev,
                tables: prev.tables.map(t => 
                    t.id === draggedItem.item.id 
                        ? { ...t, x_position: constrainedX, y_position: constrainedY }
                        : t
                )
            }));
        } else if (draggedItem.type === 'obstacle') {
            setLayout(prev => ({
                ...prev,
                obstacles: prev.obstacles.map(o => 
                    o.id === draggedItem.item.id 
                        ? { ...o, x_position: constrainedX, y_position: constrainedY }
                        : o
                )
            }));
        }
        
        // Update selected item
        setSelectedItem(prev => ({
            ...prev,
            item: { ...prev.item, x_position: constrainedX, y_position: constrainedY }
        }));
    };

    const handleMouseUp = () => {
        setDraggedItem(null);
        setDragOffset({ x: 0, y: 0 });
    };

    // Add global mouse event listeners
    useEffect(() => {
        const handleGlobalMouseMove = (e) => handleMouseMove(e);
        const handleGlobalMouseUp = () => handleMouseUp();
        
        if (draggedItem) {
            document.addEventListener('mousemove', handleGlobalMouseMove);
            document.addEventListener('mouseup', handleGlobalMouseUp);
        }
        
        return () => {
            document.removeEventListener('mousemove', handleGlobalMouseMove);
            document.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [draggedItem, dragOffset, layout.room_width, layout.room_height]);

    // Keyboard event handler for delete
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItem) {
                e.preventDefault();
                if (selectedItem.type === 'table') {
                    setLayout(prev => ({
                        ...prev,
                        tables: prev.tables.filter(t => t.id !== selectedItem.item.id)
                    }));
                } else if (selectedItem.type === 'obstacle') {
                    setLayout(prev => ({
                        ...prev,
                        obstacles: prev.obstacles.filter(o => o.id !== selectedItem.item.id)
                    }));
                }
                setSelectedItem(null);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [selectedItem]);

    return React.createElement('div', {
        className: 'flex-1 flex flex-col bg-gray-50'
    },
        // Canvas Header
        React.createElement('div', {
            className: 'bg-white shadow-sm border-b border-gray-200 p-4'
        },
            React.createElement('div', {
                className: 'flex items-center justify-between'
            },
                React.createElement('div', null,
                    React.createElement('h3', {
                        className: 'text-lg font-semibold text-gray-800'
                    }, layout.name),
                    React.createElement('p', {
                        className: 'text-sm text-gray-500'
                    },
                        selectedTool === TOOL_MODES.SELECT && 'Click to select items, drag to move them',
                        selectedTool === TOOL_MODES.TABLE && 'Click to place a new table',
                        selectedTool === TOOL_MODES.OBSTACLE && 'Click to place a new obstacle'
                    )
                ),
                selectedItem && React.createElement('div', {
                    className: 'px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium'
                }, 
                    `${selectedItem.type === 'table' ? '🪑' : '📦'} ${selectedItem.item.table_name || selectedItem.item.name}`,
                    React.createElement('span', {
                        className: 'ml-2 text-xs text-gray-600'
                    }, `(${selectedItem.item.x_position}, ${selectedItem.item.y_position})`)
                )
            )
        ),

        // Canvas
        React.createElement('div', {
            className: 'flex-1 overflow-auto p-8'
        },
            React.createElement('div', {
                ref: canvasRef,
                className: 'relative mx-auto border-2 border-gray-300 bg-white shadow-lg select-none',
                style: { 
                    width: layout.room_width * GRID_SIZE,
                    height: layout.room_height * GRID_SIZE,
                    cursor: selectedTool === TOOL_MODES.SELECT ? 'default' : 'crosshair'
                },
                onClick: handleCanvasClick,
                onMouseMove: handleMouseMove,
                onMouseUp: handleMouseUp
            },
                // Grid
                showGrid && React.createElement('div', {
                    className: 'absolute inset-0 pointer-events-none'
                },
                    // Vertical lines
                    Array.from({ length: layout.room_width + 1 }).map((_, i) =>
                        React.createElement('div', {
                            key: `v-${i}`,
                            className: 'absolute top-0 bottom-0 border-l border-gray-200',
                            style: { left: i * GRID_SIZE }
                        })
                    ),
                    // Horizontal lines
                    Array.from({ length: layout.room_height + 1 }).map((_, i) =>
                        React.createElement('div', {
                            key: `h-${i}`,
                            className: 'absolute left-0 right-0 border-t border-gray-200',
                            style: { top: i * GRID_SIZE }
                        })
                    )
                ),

                // Tables
                layout.tables.map(table => {
                    return React.createElement('div', {
                        key: table.id,
                        className: `absolute bg-blue-100 border-2 transition-all duration-200 rounded-lg ${
                            selectedItem?.item?.id === table.id 
                                ? 'border-blue-500 shadow-lg ring-2 ring-blue-300 z-10' 
                                : 'border-blue-400 hover:border-blue-500 hover:shadow-md'
                        } ${selectedTool === TOOL_MODES.SELECT ? 'cursor-move' : 'cursor-pointer'}`,
                        style: {
                            left: table.x_position * GRID_SIZE,
                            top: table.y_position * GRID_SIZE,
                            width: table.width * GRID_SIZE,
                            height: table.height * GRID_SIZE,
                            transform: draggedItem?.item?.id === table.id ? 'scale(1.05)' : 'scale(1)',
                        },
                        onMouseDown: (e) => handleItemMouseDown(e, table, 'table'),
                        onClick: (e) => {
                            e.stopPropagation();
                            if (selectedTool === TOOL_MODES.SELECT) {
                                setSelectedItem({ item: table, type: 'table' });
                            }
                        }
                    },
                        // Table label
                        React.createElement('div', {
                            className: 'absolute -top-6 left-0 bg-blue-600 text-white px-2 py-1 rounded text-xs font-semibold pointer-events-none'
                        }, table.table_name),

                        // Seat indicator
                        React.createElement('div', {
                            className: 'absolute inset-0 flex items-center justify-center pointer-events-none'
                        },
                            React.createElement('div', {
                                className: 'bg-white bg-opacity-80 px-2 py-1 rounded text-xs font-semibold text-gray-700'
                            }, `${table.max_seats} seats`)
                        )
                    );
                }),

                // Obstacles
                layout.obstacles.map(obstacle =>
                    React.createElement('div', {
                        key: obstacle.id,
                        className: `absolute border-2 transition-all duration-200 ${
                            selectedItem?.item?.id === obstacle.id 
                                ? 'border-orange-500 shadow-lg ring-2 ring-orange-300 z-10' 
                                : 'border-gray-400 hover:border-gray-500 hover:shadow-md'
                        } ${selectedTool === TOOL_MODES.SELECT ? 'cursor-move' : 'cursor-pointer'}`,
                        style: {
                            left: obstacle.x_position * GRID_SIZE,
                            top: obstacle.y_position * GRID_SIZE,
                            width: obstacle.width * GRID_SIZE,
                            height: obstacle.height * GRID_SIZE,
                            backgroundColor: obstacle.color,
                            transform: draggedItem?.item?.id === obstacle.id ? 'scale(1.05)' : 'scale(1)',
                        },
                        onMouseDown: (e) => handleItemMouseDown(e, obstacle, 'obstacle'),
                        onClick: (e) => {
                            e.stopPropagation();
                            if (selectedTool === TOOL_MODES.SELECT) {
                                setSelectedItem({ item: obstacle, type: 'obstacle' });
                            }
                        }
                    },
                        React.createElement('div', {
                            className: 'flex items-center justify-center h-full text-white font-semibold text-sm shadow-text pointer-events-none'
                        }, obstacle.name)
                    )
                )
            )
        ),

        // Instructions
        React.createElement('div', {
            className: 'bg-white border-t border-gray-200 p-4'
        },
            React.createElement('div', {
                className: 'text-sm text-gray-600 max-w-4xl mx-auto'
            },
                React.createElement('div', {
                    className: 'grid grid-cols-1 md:grid-cols-2 gap-4'
                },
                    React.createElement('div', null,
                        React.createElement('h4', {
                            className: 'font-semibold text-gray-800 mb-2'
                        }, 'Instructions:'),
                        React.createElement('ul', {
                            className: 'space-y-1'
                        },
                            React.createElement('li', null, '• Select the tool you want to use from the sidebar'),
                            React.createElement('li', null, '• Use Select tool to move items by dragging'),
                            React.createElement('li', null, '• Click on empty space to place new items'),
                            React.createElement('li', null, '• Press Delete to remove selected items')
                        )
                    ),
                    React.createElement('div', null,
                        React.createElement('h4', {
                            className: 'font-semibold text-gray-800 mb-2'
                        }, 'Keyboard Shortcuts:'),
                        React.createElement('ul', {
                            className: 'space-y-1'
                        },
                            React.createElement('li', null, 
                                React.createElement('kbd', {
                                    className: 'px-1 py-0.5 bg-gray-100 rounded text-xs mr-2'
                                }, 'Delete'),
                                'Remove selected item'
                            ),
                            React.createElement('li', null, 
                                React.createElement('kbd', {
                                    className: 'px-1 py-0.5 bg-gray-100 rounded text-xs mr-2'
                                }, 'Click'),
                                'Select item'
                            ),
                            React.createElement('li', null, 
                                React.createElement('kbd', {
                                    className: 'px-1 py-0.5 bg-gray-100 rounded text-xs mr-2'
                                }, 'Drag'),
                                'Move selected item'
                            )
                        )
                    )
                )
            )
        )
    );
};