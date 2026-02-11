import React from 'react';

const WorkerSelector = ({ selectedWorkers, setSelectedWorkers }) => {
    const workers = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

    const toggleWorker = (worker) => {
        setSelectedWorkers(prev =>
            prev.includes(worker)
                ? prev.filter(w => w !== worker)
                : [...prev, worker]
        );
    };

    return (
        <div className="worker-selector-container glass-card">
            <label className="selector-label">Assemble Your Strategy Team</label>
            <div className="worker-grid">
                {workers.map(worker => (
                    <button
                        key={worker}
                        className={`worker-pill ${selectedWorkers.includes(worker) ? 'selected' : ''}`}
                        onClick={() => toggleWorker(worker)}
                    >
                        Agent {worker}
                    </button>
                ))}
            </div>
            <p className="helper-text">
                {selectedWorkers.length} Experts active in the orchestration room.
            </p>
        </div>
    );
};

export default WorkerSelector;
