// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title FrameCut — cut a single frame from a video and mint it as a collectible
/// @notice A creator "cuts" one frame (source video + timestamp) into an on-chain
///         still. Fans collect an edition for a USDC micro-payment that lands in
///         the creator's wallet on the spot. Built for ARC: every collect is a
///         stable, instant, native-USDC payment — no token, no middleman.
contract FrameCut {
    struct Frame {
        uint256 id;
        address creator;
        string video;     // source video url
        uint32 atMs;      // timestamp of the cut frame, in milliseconds
        string title;
        uint256 price;    // USDC per edition (native, 18 decimals)
        uint256 editions; // editions collected so far
        uint64 cutAt;
    }

    uint256 public frameCount;
    uint256 public totalCollected; // total editions sold
    uint256 public totalVolume;    // total USDC paid through the contract

    mapping(uint256 => Frame) public frames;
    mapping(address => uint256[]) private _byCreator;
    mapping(address => uint256[]) private _collected;
    mapping(uint256 => mapping(address => uint256)) public editionsOwned;

    event Cut(uint256 indexed id, address indexed creator, string video, uint32 atMs, string title, uint256 price);
    event Collected(uint256 indexed id, address indexed collector, address indexed creator, uint256 edition, uint256 price);

    function cut(string calldata video, uint32 atMs, string calldata title, uint256 price) external returns (uint256) {
        require(bytes(video).length > 0 && bytes(video).length <= 300, "bad video");
        require(bytes(title).length > 0 && bytes(title).length <= 120, "bad title");

        uint256 id = ++frameCount;
        frames[id] = Frame(id, msg.sender, video, atMs, title, price, 0, uint64(block.timestamp));
        _byCreator[msg.sender].push(id);
        emit Cut(id, msg.sender, video, atMs, title, price);
        return id;
    }

    /// @notice Collect an edition of a frame, paying the creator in USDC.
    function collect(uint256 id) external payable {
        Frame storage f = frames[id];
        require(f.creator != address(0), "no such frame");
        require(f.creator != msg.sender, "cannot collect your own frame");
        require(msg.value >= f.price, "send the asking price");

        // checks-effects-interactions
        f.editions += 1;
        totalCollected += 1;
        totalVolume += msg.value;
        if (editionsOwned[id][msg.sender] == 0) _collected[msg.sender].push(id);
        editionsOwned[id][msg.sender] += 1;

        if (msg.value > 0) {
            (bool ok, ) = payable(f.creator).call{value: msg.value}("");
            require(ok, "payout failed");
        }
        emit Collected(id, msg.sender, f.creator, f.editions, msg.value);
    }

    function framesOf(address a) external view returns (uint256[] memory) { return _byCreator[a]; }
    function collectedBy(address a) external view returns (uint256[] memory) { return _collected[a]; }
    function getFrame(uint256 id) external view returns (Frame memory) { return frames[id]; }
}
