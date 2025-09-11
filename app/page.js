"use client";

import React, { useState } from 'react';

// Main App Component for the Next.js page
export default function SteelCutCalculatorPage() {
    // State for base plate dimensions
    const [basePlate, setBasePlate] = useState({ width: 1200, height: 3000 });
    // State for the list of cuts needed
    const [cuts, setCuts] = useState([
        { id: 1, width: 600, height: 1000, quantity: 5 }
    ]);
    // State for the calculated layouts of placed pieces (one layout per plate)
    const [layouts, setLayouts] = useState([]);
    // State for statistics
    const [stats, setStats] = useState({ totalPieces: 0, usedArea: 0, totalBaseArea: 0, efficiency: 0, platesRequired: 0 });

    // Function to handle input changes for the base plate
    const handleBasePlateChange = (e) => {
        const { name, value } = e.target;
        setBasePlate(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
    };

    // Function to handle input changes for individual cuts
    const handleCutChange = (id, e) => {
        const { name, value } = e.target;
        setCuts(prevCuts => 
            prevCuts.map(cut => 
                cut.id === id ? { ...cut, [name]: parseInt(value) || 0 } : cut
            )
        );
    };
    
    // Function to add a new cut to the list
    const addCut = () => {
        const newId = cuts.length > 0 ? Math.max(...cuts.map(c => c.id)) + 1 : 1;
        setCuts(prev => [...prev, { id: newId, width: 0, height: 0, quantity: 1 }]);
    };
    
    // Function to remove a cut from the list
    const removeCut = (id) => {
        setCuts(prev => prev.filter(cut => cut.id !== id));
    };

    // The core logic for calculating the optimal layout across multiple plates
    const calculateLayout = () => {
        if (!basePlate.width || !basePlate.height || cuts.length === 0) {
            setLayouts([]);
            return;
        };

        let piecesToPlace = [];
        cuts.forEach(cut => {
            for (let i = 0; i < cut.quantity; i++) {
                piecesToPlace.push({ ...cut, originalId: cut.id, pieceId: `${cut.id}-${i}` });
            }
        });

        piecesToPlace.sort((a, b) => b.height - a.height || b.width - a.width);

        const allLayouts = [];
        
        while(piecesToPlace.length > 0) {
            const currentPlateLayout = [];
            // A simplified grid for faster calculation in a JS environment
            const grid = [];

            const canPlace = (piece, x, y) => {
                if (x + piece.width > basePlate.width || y + piece.height > basePlate.height) return false;
                for (const p of grid) {
                    if (x < p.x + p.width && x + piece.width > p.x && y < p.y + p.height && y + piece.height > p.y) {
                        return false;
                    }
                }
                return true;
            };

            const placePieceOnGrid = (piece, x, y) => {
                const newPiece = { ...piece, x, y };
                grid.push(newPiece);
                currentPlateLayout.push(newPiece);
            };
            
            let remainingPieces = [];
            for(const piece of piecesToPlace) {
                let placed = false;
                // A simple greedy algorithm: find the first available spot
                for (let y = 0; y <= basePlate.height; y++) {
                    for (let x = 0; x <= basePlate.width; x++) {
                        if (canPlace(piece, x, y)) {
                            placePieceOnGrid(piece, x, y);
                            placed = true;
                            break;
                        }
                        const rotatedPiece = { ...piece, width: piece.height, height: piece.width };
                        if (canPlace(rotatedPiece, x, y)) {
                            placePieceOnGrid(rotatedPiece, x, y);
                            placed = true;
                            break;
                        }
                    }
                    if (placed) break;
                }
                 if (!placed) {
                    remainingPieces.push(piece);
                }
            }
            allLayouts.push(currentPlateLayout);
            piecesToPlace = remainingPieces;
        }

        setLayouts(allLayouts);
        
        // Update stats
        let totalUsedArea = 0;
        const allPlacedPieces = allLayouts.flat();
        allPlacedPieces.forEach(p => {
            totalUsedArea += p.width * p.height;
        });
        
        const totalBaseArea = allLayouts.length * basePlate.width * basePlate.height;

        setStats({
            totalPieces: allPlacedPieces.length,
            usedArea: totalUsedArea,
            totalBaseArea: totalBaseArea,
            efficiency: totalBaseArea > 0 ? ((totalUsedArea / totalBaseArea) * 100).toFixed(2) : 0,
            platesRequired: allLayouts.length
        });
    };

    // SVG Visualization Component
    const Visualization = ({ basePlate, layout }) => {
        if (!basePlate.width || !basePlate.height || !layout) {
            return null;
        }
        
        const colors = ["#3b82f6", "#22c55e", "#eab308", "#8b5cf6", "#ec4899", "#14b8a6"];
        const wasteColor = "#ef4444"; // Red for unused parts

        return (
            <div className="w-full h-auto p-4 relative" style={{aspectRatio: `${basePlate.width} / ${basePlate.height}`}}>
                <svg 
                    width="100%" 
                    height="100%" 
                    viewBox={`-50 -50 ${basePlate.width + 100} ${basePlate.height + 100}`}
                    preserveAspectRatio="xMidYMid meet"
                >
                    <defs>
                        <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e5e7eb" strokeWidth="1"/>
                        </pattern>
                    </defs>
                    
                    <rect x="0" y="0" width={basePlate.width} height={basePlate.height} fill="url(#grid)" stroke="#9ca3af" strokeWidth="2"/>
                    <rect x="0" y="0" width={basePlate.width} height={basePlate.height} fill={wasteColor} />

                    <text x={basePlate.width / 2} y="-20" textAnchor="middle" className="text-sm font-medium fill-gray-700">{basePlate.width} mm</text>
                    <text x={-20} y={basePlate.height / 2} textAnchor="middle" transform={`rotate(-90, -20, ${basePlate.height/2})`} className="text-sm font-medium fill-gray-700">{basePlate.height} mm</text>

                    {layout.map((piece) => (
                        <g key={piece.pieceId}>
                            <rect
                                x={piece.x}
                                y={piece.y}
                                width={piece.width}
                                height={piece.height}
                                fill={colors[piece.originalId % colors.length]}
                                fillOpacity="0.7"
                                stroke="#1f2937"
                                strokeWidth="4"
                                strokeDasharray="15 8"
                                rx="2"
                                ry="2"
                            />
                            <text
                                x={piece.x + 10}
                                y={piece.y + 25}
                                textAnchor="start"
                                className="fill-gray-900 font-bold"
                                style={{ fontSize: "20px" }}
                            >
                                {`${piece.width}x${piece.height}`}
                            </text>
                        </g>
                    ))}
                </svg>
            </div>
        );
    };

    const placedCounts = layouts.flat().reduce((acc, piece) => {
        acc[piece.originalId] = (acc[piece.originalId] || 0) + 1;
        return acc;
    }, {});

    return (
        <main className="bg-gray-100 flex items-center justify-center min-h-screen py-8">
            <div className="w-full max-w-7xl mx-auto p-4 md:p-8 bg-white rounded-2xl shadow-lg my-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Steel Cut Calculator</h1>
                <p className="text-gray-500 mb-8">Optimize your steel plate cutting and minimize waste.</p>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Inputs and Controls */}
                    <div className="lg:col-span-1 flex flex-col space-y-6">
                        {/* Base Plate Inputs */}
                        <div>
                            <h2 className="text-xl font-semibold text-gray-700 mb-3">Bahan Plat (Base Plate)</h2>
                            <div className="flex items-center space-x-2 bg-gray-50 p-4 rounded-lg">
                                <input type="number" name="width" value={basePlate.width} onChange={handleBasePlateChange} className="w-full text-black p-2 border rounded-md shadow-sm" placeholder="Panjang (mm)" />
                                <span className="text-black">X</span>
                                <input type="number" name="height" value={basePlate.height} onChange={handleBasePlateChange} className="w-full text-black p-2 border rounded-md shadow-sm" placeholder="Lebar (mm)" />
                            </div>
                        </div>

                        {/* Cuts List */}
                        <div className="flex-grow">
                            <h2 className="text-xl font-semibold text-gray-700 mb-3">Potongan (Cuts Needed)</h2>
                            <div className="space-y-3 max-h-[35vh] overflow-y-auto pr-2">
                                {cuts.map((cut) => (
                                    <div key={cut.id} className="flex items-center space-x-2 bg-gray-50 p-3 rounded-lg">
                                        <input type="number" name="width" value={cut.width} onChange={(e) => handleCutChange(cut.id, e)} className="w-full text-black p-2 border rounded-md shadow-sm" placeholder="Panjang"/>
                                        <span className="text-black">X</span>
                                        <input type="number" name="height" value={cut.height} onChange={(e) => handleCutChange(cut.id, e)} className="w-full text-black p-2 border rounded-md shadow-sm" placeholder="Lebar"/>
                                        <input type="number" name="quantity" value={cut.quantity} onChange={(e) => handleCutChange(cut.id, e)} className="w-20 text-black p-2 border rounded-md shadow-sm" placeholder="Pcs"/>
                                        <button onClick={() => removeCut(cut.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-full transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button onClick={addCut} className="w-full mt-4 bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition-all">
                                + Add Cut Type
                            </button>
                        </div>
                        
                         <button onClick={calculateLayout} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-all shadow-lg text-lg">
                            Calculate Layout
                        </button>

                        {/* Summary / Stats */}
                        {layouts.length > 0 && (
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h3 className="text-lg font-semibold text-gray-700 mb-3">Summary</h3>
                                <div className="space-y-2 text-sm text-gray-600">
                                    <div className="flex justify-between font-bold">
                                        <span>Plates Required:</span>
                                        <span className="text-indigo-600">{stats.platesRequired}</span>
                                    </div>
                                    <hr className="my-2"/>
                                    {cuts.map(cut => {
                                        const placed = placedCounts[cut.id] || 0;
                                        return (
                                            <div key={cut.id} className="flex justify-between">
                                                <span>Cut {cut.width}x{cut.height}:</span>
                                                <span className={`font-medium ${placed < cut.quantity ? 'text-orange-500' : 'text-green-600'}`}>{placed} / {cut.quantity} placed</span>
                                            </div>
                                        );
                                    })}
                                    <hr className="my-2"/>
                                    <div className="flex justify-between font-semibold">
                                        <span>Overall Usage:</span>
                                        <span className="text-blue-600">{stats.efficiency}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                                        <div className="bg-blue-500 h-2.5 rounded-full" style={{width: `${stats.efficiency}%`}}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Visualization */}
                    <div className="lg:col-span-2 bg-gray-100 rounded-lg min-h-[75vh] max-h-[75vh] overflow-y-auto p-4 space-y-6">
                       {layouts.length > 0 ? (
                            layouts.map((layout, index) => (
                                <div key={index} className="bg-white p-4 rounded-xl shadow-md">
                                    <h3 className="text-lg font-bold text-gray-800 mb-2">Plate {index + 1}</h3>
                                    <div className="bg-gray-200/50 rounded-lg">
                                        <Visualization basePlate={basePlate} layout={layout} />
                                    </div>
                                </div>
                            ))
                       ) : (
                            <div className="flex items-center justify-center h-full text-center text-gray-500">
                                <div>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    <h3 className="mt-2 text-sm font-medium">No Layout Calculated</h3>
                                    <p className="mt-1 text-sm">Enter your dimensions and click "Calculate Layout" to see the results.</p>
                                </div>
                            </div>
                       )}
                    </div>
                </div>
            </div>
        </main>
    );
};
