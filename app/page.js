"use client";

import React, { useState } from "react";

// Main App Component for the Next.js page
export default function SteelCutCalculatorPage() {
  // State for base plate dimensions
  const [basePlate, setBasePlate] = useState({ width: 0, height: 0 });
  // State for the list of cuts needed
  const [cuts, setCuts] = useState([
    { id: 1, width: 0, height: 0, quantity: 1 },
  ]);
  // State for the calculated layouts. Each layout now contains pieces, waste, and its own stats.
  const [layouts, setLayouts] = useState([]);
  // State for statistics
  const [stats, setStats] = useState({
    totalPieces: 0,
    usedArea: 0,
    wasteArea: 0,
    totalBaseArea: 0,
    efficiency: 0,
    platesRequired: 0,
  });
  // New state for calculation options
  const [options, setOptions] = useState({ respectGrain: true });
  // New state for loading indicator
  const [isLoading, setIsLoading] = useState(false);

  // Function to handle input changes for the base plate
  const handleBasePlateChange = (e) => {
    const { name, value } = e.target;
    setBasePlate((prev) => ({ ...prev, [name]: parseInt(value) || 0 }));
  };

  // Function to handle input changes for individual cuts
  const handleCutChange = (id, e) => {
    const { name, value } = e.target;
    setCuts((prevCuts) =>
      prevCuts.map((cut) =>
        cut.id === id ? { ...cut, [name]: parseInt(value) || 0 } : cut
      )
    );
  };

  // Function to handle options changes
  const handleOptionsChange = (e) => {
    const { name, type, checked } = e.target;
    setOptions((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : false,
    }));
  };

  // Function to add a new cut to the list
  const addCut = () => {
    const newId = cuts.length > 0 ? Math.max(...cuts.map((c) => c.id)) + 1 : 1;
    setCuts((prev) => [
      ...prev,
      { id: newId, width: 0, height: 0, quantity: 1 },
    ]);
  };

  // Function to remove a cut from the list
  const removeCut = (id) => {
    setCuts((prev) => prev.filter((cut) => cut.id !== id));
  };

  // The core logic for calculating the optimal layout across multiple plates
  const calculateLayout = () => {
    setIsLoading(true);

    // Use a timeout to allow the UI to update to the loading state
    setTimeout(() => {
      if (!basePlate.width || !basePlate.height || cuts.length === 0) {
        setLayouts([]);
        setStats({
          totalPieces: 0,
          usedArea: 0,
          wasteArea: 0,
          totalBaseArea: 0,
          efficiency: 0,
          platesRequired: 0,
        });
        setIsLoading(false);
        return;
      }

      // 1. Flatten the list of cuts into individual pieces
      let piecesToPlace = [];
      cuts.forEach((cut) => {
        if (cut.width > 0 && cut.height > 0 && cut.quantity > 0) {
          for (let i = 0; i < cut.quantity; i++) {
            piecesToPlace.push({
              ...cut,
              originalId: cut.id,
              pieceId: `${cut.id}-${i}`,
              area: cut.width * cut.height,
            });
          }
        }
      });

      // 2. Sort pieces from largest to smallest by area. This is a crucial heuristic.
      piecesToPlace.sort((a, b) => b.area - a.area);

      const allLayouts = [];

      // 3. Keep creating new plates until all pieces are placed
      while (piecesToPlace.length > 0) {
        const currentPlatePieces = [];
        // Start with a single free rectangle representing the whole plate
        let freeRects = [{ x: 0, y: 0, width: basePlate.width, height: basePlate.height }];
        const piecesForNextPlate = [];

        // 4. Try to place each remaining piece on the current plate
        for (const piece of piecesToPlace) {
          let bestFit = { score: Infinity, rectIndex: -1, rotated: false };

          // 5. Find the best free rectangle for the current piece
          for (let i = 0; i < freeRects.length; i++) {
            const freeRect = freeRects[i];
            const orientations = options.respectGrain ? [false] : [false, true];

            for (const rotated of orientations) {
              const pieceW = rotated ? piece.height : piece.width;
              const pieceH = rotated ? piece.width : piece.height;

              if (pieceW <= freeRect.width && pieceH <= freeRect.height) {
                // Heuristic: Best Short Side Fit (BSSF)
                // We want the placement that leaves the smallest leftover strip.
                const score = Math.min(
                  freeRect.width - pieceW,
                  freeRect.height - pieceH
                );
                if (score < bestFit.score) {
                  bestFit = { score, rectIndex: i, rotated };
                }
              }
            }
          }

          // 6. If a suitable spot was found, place the piece
          if (bestFit.rectIndex !== -1) {
            const targetRect = freeRects.splice(bestFit.rectIndex, 1)[0]; // Get and remove the target rectangle
            const placeWidth = bestFit.rotated ? piece.height : piece.width;
            const placeHeight = bestFit.rotated ? piece.width : piece.height;

            currentPlatePieces.push({
              ...piece,
              width: placeWidth,
              height: placeHeight,
              x: targetRect.x,
              y: targetRect.y,
            });

            // 7. Split the remaining space into new free rectangles (Guillotine method with SSLA heuristic)
            const leftoverW = targetRect.width - placeWidth;
            const leftoverH = targetRect.height - placeHeight;
            
            if (leftoverW > 0 && leftoverH > 0) { // L-shape leftover
                // Split Shorter Leftover Axis (SSLA) heuristic:
                // This tends to create more squarish, and thus more usable, free spaces.
                if (leftoverW <= leftoverH) {
                    // Split vertically (shorter leftover axis is width)
                    // Add the rectangle to the right of the placed piece
                    freeRects.push({
                        x: targetRect.x + placeWidth,
                        y: targetRect.y,
                        width: leftoverW,
                        height: targetRect.height
                    });
                    // Add the rectangle below the placed piece
                    freeRects.push({
                        x: targetRect.x,
                        y: targetRect.y + placeHeight,
                        width: placeWidth,
                        height: leftoverH
                    });
                } else {
                    // Split horizontally (shorter leftover axis is height)
                    // Add the rectangle below the placed piece
                    freeRects.push({
                        x: targetRect.x,
                        y: targetRect.y + placeHeight,
                        width: targetRect.width,
                        height: leftoverH
                    });
                    // Add the rectangle to the right of the placed piece
                    freeRects.push({
                        x: targetRect.x + placeWidth,
                        y: targetRect.y,
                        width: leftoverW,
                        height: placeHeight
                    });
                }
            } else if (leftoverW > 0) { // Only a rectangle to the right is left
                freeRects.push({
                    x: targetRect.x + placeWidth,
                    y: targetRect.y,
                    width: leftoverW,
                    height: targetRect.height,
                });
            } else if (leftoverH > 0) { // Only a rectangle below is left
                freeRects.push({
                    x: targetRect.x,
                    y: targetRect.y + placeHeight,
                    width: targetRect.width,
                    height: leftoverH,
                });
            }

          } else {
            // If the piece couldn't fit, save it for the next plate
            piecesForNextPlate.push(piece);
          }
        }
        
        // If any pieces were placed on this plate, save the layout
        if (currentPlatePieces.length > 0) {
          const plateUsedArea = currentPlatePieces.reduce(
            (acc, p) => acc + p.width * p.height,
            0
          );
          const plateBaseArea = basePlate.width * basePlate.height;
          const plateStats = {
            usedArea: plateUsedArea,
            wasteArea: plateBaseArea - plateUsedArea,
            efficiency: ((plateUsedArea / plateBaseArea) * 100).toFixed(2),
            pieceCount: currentPlatePieces.length,
          };

          allLayouts.push({
            pieces: currentPlatePieces,
            waste: freeRects, // The remaining free rectangles are the waste
            stats: plateStats,
          });
        }

        // If no pieces could be placed on a fresh plate, stop to prevent an infinite loop
        if (piecesToPlace.length === piecesForNextPlate.length) {
            break;
        }

        // The pieces for the next iteration are the ones that couldn't fit
        piecesToPlace = piecesForNextPlate;
      }

      setLayouts(allLayouts);
      
      // 8. Calculate final statistics across all plates
      let totalUsedArea = 0;
      const allPlacedPieces = allLayouts.flatMap((l) => l.pieces);
      allPlacedPieces.forEach((p) => {
        totalUsedArea += p.width * p.height;
      });
      const totalBaseArea = allLayouts.length * basePlate.width * basePlate.height;

      setStats({
        totalPieces: allPlacedPieces.length,
        usedArea: totalUsedArea,
        wasteArea: totalBaseArea - totalUsedArea,
        totalBaseArea: totalBaseArea,
        efficiency:
          totalBaseArea > 0
            ? ((totalUsedArea / totalBaseArea) * 100).toFixed(2)
            : 0,
        platesRequired: allLayouts.length,
      });
      setIsLoading(false);
    }, 50); // End of setTimeout
  };

  // SVG Visualization Component
  const Visualization = ({ basePlate, layout }) => {
    if (!basePlate.width || !basePlate.height || !layout || !layout.pieces)
      return null;

    const { pieces, waste } = layout;
    const colors = [
      "#60a5fa", "#4ade80", "#facc15", "#a78bfa",
      "#f472b6", "#2dd4bf", "#fb923c", "#818cf8"
    ]; 
    const wasteColor = "#f87171";

    const rotatedViewBoxWidth = basePlate.height;
    const rotatedViewBoxHeight = basePlate.width;

    const getFontSize = (width, height) => {
      const smallerDim = Math.min(width, height);
      if (smallerDim < 50) return "12px";
      if (smallerDim < 100) return "18px";
      if (smallerDim < 300) return "24px";
      return "32px";
    };

    return (
      <div
        className="w-full h-auto p-4 relative"
        style={{
          aspectRatio: `${rotatedViewBoxWidth} / ${rotatedViewBoxHeight}`,
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`-50 -50 ${rotatedViewBoxWidth + 100} ${
            rotatedViewBoxHeight + 100
          }`}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <pattern
              id="grid" width="50" height="50" patternUnits="userSpaceOnUse"
            >
              <path
                d="M 50 0 L 0 0 0 50" fill="none" stroke="#e5e7eb" strokeWidth="2"
              />
            </pattern>
            <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
              <feOffset dx="2" dy="2" result="offsetblur" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.5" />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect
            x="0" y="0" width={rotatedViewBoxWidth} height={rotatedViewBoxHeight}
            fill="url(#grid)" stroke="#9ca3af" strokeWidth="4"
          />

          {/* Render Waste Rectangles */}
          {waste &&
            waste.map((rect, index) => {
              const rotatedX = rect.y;
              const rotatedY = basePlate.width - rect.x - rect.width;
              const rotatedRectWidth = rect.height;
              const rotatedRectHeight = rect.width;

              return (
                <rect
                  key={`waste-rect-${index}`}
                  x={rotatedX}
                  y={rotatedY}
                  width={rotatedRectWidth}
                  height={rotatedRectHeight}
                  fill={wasteColor}
                  fillOpacity="0.9"
                />
              );
            })}

          {/* Render Placed Pieces - Rectangles */}
          {pieces.map((piece) => {
            const rotatedX = piece.y;
            const rotatedY = basePlate.width - piece.x - piece.width;
            const rotatedPieceWidth = piece.height;
            const rotatedPieceHeight = piece.width;

            return (
              <rect
                key={`${piece.pieceId}-rect`}
                x={rotatedX}
                y={rotatedY}
                width={rotatedPieceWidth}
                height={rotatedPieceHeight}
                fill={colors[piece.originalId % colors.length]}
                fillOpacity="0.85"
                stroke="#1f2937"
                strokeWidth="4"
                strokeDasharray="15 8"
                style={{ filter: "url(#dropShadow)" }}
              />
            );
          })}

          {/* Render Waste Text on top */}
          {waste &&
            waste.map((rect, index) => {
              const rotatedX = rect.y;
              const rotatedY = basePlate.width - rect.x - rect.width;
              const rotatedRectWidth = rect.height;
              const rotatedRectHeight = rect.width;
              const showText = rect.width > 50 && rect.height > 50;

              return showText ? (
                <text
                  key={`waste-text-${index}`}
                  x={rotatedX + rotatedRectWidth / 2}
                  y={rotatedY + rotatedRectHeight / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-white font-semibold pointer-events-none"
                  stroke="black"
                  strokeWidth="0.5px"
                  paintOrder="stroke"
                  style={{
                    fontSize: getFontSize(
                      rotatedRectWidth,
                      rotatedRectHeight
                    ),
                  }}
                >
                  {`${rect.width}x${rect.height}`}
                </text>
              ) : null;
            })}

          {/* Render Placed Pieces Text on top */}
          {pieces.map((piece) => {
            const rotatedX = piece.y;
            const rotatedY = basePlate.width - piece.x - piece.width;
            const rotatedPieceWidth = piece.height;
            const rotatedPieceHeight = piece.width;
            const showText = rotatedPieceWidth > 40 && rotatedPieceHeight > 20;

            return showText ? (
              <text
                key={`${piece.pieceId}-text`}
                x={rotatedX + rotatedPieceWidth / 2}
                y={rotatedY + rotatedPieceHeight / 2}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-white font-bold pointer-events-none"
                stroke="black"
                strokeWidth="1px"
                paintOrder="stroke"
                style={{
                  fontSize: getFontSize(
                    rotatedPieceWidth,
                    rotatedPieceHeight
                  ),
                }}
              >
                {`${piece.width}x${piece.height}`}
              </text>
            ) : null;
          })}


          {/* Render Base Plate Dimensions Last to be on Top */}
          <text
            x={rotatedViewBoxWidth / 2} y="-15" textAnchor="middle"
            className="text-5xl font-bold fill-gray-800"
          >
            {basePlate.height} mm
          </text>
          <text
            x={-15} y={rotatedViewBoxHeight / 2} textAnchor="middle"
            transform={`rotate(-90, -15, ${rotatedViewBoxHeight / 2})`}
            className="text-5xl font-bold fill-gray-800"
          >
            {basePlate.width} mm
          </text>
        </svg>
      </div>
    );
  };

  // UI Component
  const placedCounts = layouts
    .flatMap((l) => l.pieces)
    .reduce((acc, piece) => {
      acc[piece.originalId] = (acc[piece.originalId] || 0) + 1;
      return acc;
    }, {});

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
              @media print {
                  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                  .no-print { display: none !important; }
                  main { padding: 0; margin: 0; }
                  .print-container { box-shadow: none !important; margin: 0; max-width: 100% !important; border-radius: 0; }
                  .print-visualization { 
                      page-break-inside: avoid;
                      max-height: 95vh;
                   }
                  .print-grid-container { display: block !important; }
                  .print-results-column {
                      width: 100% !important;
                      min-height: auto !important;
                      max-height: none !important;
                      overflow: visible !important;
                  }
              }
            `,
        }}
      />
      <main className="bg-gray-100 flex items-center justify-center min-h-screen py-8">
        <div className="w-full max-w-7xl mx-auto p-4 md:p-8 bg-white rounded-2xl shadow-lg my-8 print-container">
          <div className="flex justify-between items-center no-print">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                Calculator Layout Cutting Besi
              </h1>
              <p className="text-gray-500 mb-8">
                Optimalkan pemotongan plat besi Anda.
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition-all flex items-center space-x-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v6a2 2 0 002 2h1v-4a1 1 0 011-1h8a1 1 0 011 1v4h1a2 2 0 002-2v-6a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
              </svg>
              <span>Print</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print-grid-container">
            {/* Left Column: Inputs and Controls */}
            <div className="lg-col-span-1 flex flex-col space-y-6 no-print">
              {/* Base Plate & Options */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h2 className="text-xl font-semibold text-gray-700 mb-3">
                  Ukuran Bahan Besi
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input type="number" name="width" value={basePlate.width} onChange={handleBasePlateChange} className="text-black w-full p-2 rounded-md shadow-sm shadow-black" placeholder="Panjang (mm)" />
                    <span className="text-black">X</span>
                    <input type="number" name="height" value={basePlate.height} onChange={handleBasePlateChange} className="text-black w-full p-2 rounded-md shadow-sm shadow-black" placeholder="Lebar (mm)" />
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" id="respectGrain" name="respectGrain" checked={!options.respectGrain} onChange={(e) => setOptions(prev => ({ ...prev, respectGrain: !e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <label htmlFor="respectGrain" className="ml-2 block text-sm text-gray-900">
                      Rotasi Potongan Diizinkan
                    </label>
                  </div>
                </div>
              </div>

              {/* Cuts List */}
              <div className="flex-grow">
                <h2 className="text-xl font-semibold text-gray-700 mb-3">
                  Ukuran Potongan (mm)
                </h2>
                <div className="space-y-3 max-h-[35vh] overflow-y-auto pr-2">
                  {cuts.map((cut) => (
                    <div key={cut.id} className="flex items-center space-x-2 bg-gray-50 p-3 rounded-lg">
                      <input type="number" name="width" value={cut.width} onChange={(e) => handleCutChange(cut.id, e)} className="text-black w-full p-2 border rounded-md shadow-sm" placeholder="Panjang" />
                      <span className="text-black">X</span>
                      <input type="number" name="height" value={cut.height} onChange={(e) => handleCutChange(cut.id, e)} className="text-black w-full p-2 border rounded-md shadow-sm" placeholder="Lebar" />
                      <input type="number" name="quantity" value={cut.quantity} onChange={(e) => handleCutChange(cut.id, e)} className="text-black w-20 p-2 border rounded-md shadow-sm" placeholder="Pcs" />
                      <button onClick={() => removeCut(cut.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-full transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={addCut} className="w-full mt-4 bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition-all">
                  + Tambah Ukuran Potongan
                </button>
              </div>

              <button onClick={calculateLayout} disabled={isLoading} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-all shadow-lg text-lg disabled:bg-blue-400 disabled:cursor-not-allowed">
                {isLoading ? "Menghitung..." : "Hitung Layout"}
              </button>

              {/* Summary / Stats */}
              {layouts.length > 0 && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-700 mb-3">
                    Ringkasan Hasil
                  </h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between font-bold">
                      <span>Plat yang dibutuhkan:</span>
                      <span className="text-indigo-600">
                        {stats.platesRequired}
                      </span>
                    </div>
                    <hr className="my-2" />
                    {cuts.map((cut) => {
                      const placed = placedCounts[cut.id] || 0;
                      return (
                        <div key={cut.id} className="flex justify-between">
                          <span>
                            Potongan {cut.width}x{cut.height} (mm):
                          </span>
                          <span
                            className={`font-medium ${
                              placed < cut.quantity
                                ? "text-orange-500"
                                : "text-green-600"
                            }`}
                          >
                            {placed} / {cut.quantity} pcs
                          </span>
                        </div>
                      );
                    })}
                    <hr className="my-2" />
                    <div className="flex justify-between font-semibold">
                      <span>Total Bahan Terbuang:</span>
                      <span>{stats.wasteArea.toLocaleString()} mm²</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Penggunaan Keseluruhan:</span>
                      <span className="text-blue-600">{stats.efficiency}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                      <div
                        className="bg-blue-500 h-2.5 rounded-full"
                        style={{ width: `${stats.efficiency}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Visualization */}
            <div className="lg:col-span-2 bg-gray-100 rounded-lg min-h-[75vh] max-h-[80vh] overflow-y-auto p-4 space-y-6 print-results-column">
              {layouts.length > 0 ? (
                layouts.map((layout, index) => (
                  <div
                    key={index}
                    className="bg-white p-4 rounded-xl shadow-md print-visualization"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-bold text-gray-800">
                        Plat {index + 1}
                      </h3>
                      {layout.stats && (
                        <div className="text-sm font-semibold">
                          <span className="text-gray-600">Usage: </span>
                          <span className="text-blue-600">
                            {layout.stats.efficiency}%
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="bg-white rounded-lg">
                      <Visualization basePlate={basePlate} layout={layout} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-full text-center text-gray-500">
                  <div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium">
                      Tidak ada layout untuk ditampilkan
                    </h3>
                    <p className="mt-1 text-sm">
                      Masukkan dimensi Anda dan klik &apos;Hitung Layout&apos; untuk melihat hasilnya.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

