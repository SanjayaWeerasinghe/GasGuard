// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract GasGuard {
    struct GasEvent {
        uint256 timestamp;
        string zone;
        string gasType;
        uint256 ppm;
        string riskLevel;
    }

    GasEvent[] public events;

    event GasEventRecorded(
        uint256 indexed id,
        string zone,
        string gasType,
        uint256 ppm,
        string riskLevel,
        uint256 timestamp
    );

    function recordEvent(
        string memory _zone,
        string memory _gasType,
        uint256 _ppm,
        string memory _riskLevel
    ) public {
        events.push(
            GasEvent(
                block.timestamp,
                _zone,
                _gasType,
                _ppm,
                _riskLevel
            )
        );

        emit GasEventRecorded(
            events.length - 1,
            _zone,
            _gasType,
            _ppm,
            _riskLevel,
            block.timestamp
        );
    }

    function getEvent(uint256 index)
        public
        view
        returns (
            uint256,
            string memory,
            string memory,
            uint256,
            string memory
        )
    {
        GasEvent memory e = events[index];
        return (e.timestamp, e.zone, e.gasType, e.ppm, e.riskLevel);
    }

    function getEventCount() public view returns (uint256) {
        return events.length;
    }
}
